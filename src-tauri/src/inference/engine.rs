//! Text generation on llama.cpp.
//!
//! One model and one context are kept loaded for the life of a chat. The
//! context remembers the tokens it has already processed, so each new message
//! only pays for the text that was added since the last reply — time to the
//! first word no longer grows with the length of the conversation.

use std::ffi::{c_char, c_void, CStr};
use std::num::NonZeroU32;
use std::path::Path;
use std::sync::OnceLock;
use std::time::Instant;

use llama_cpp_2::context::params::LlamaContextParams;
use llama_cpp_2::context::LlamaContext;
use llama_cpp_2::llama_backend::LlamaBackend;
use llama_cpp_2::llama_batch::LlamaBatch;
use llama_cpp_2::model::params::LlamaModelParams;
use llama_cpp_2::model::LlamaModel;
use llama_cpp_2::sampling::LlamaSampler;
use llama_cpp_2::token::LlamaToken;
use llama_cpp_2::{LlamaStateSeqFlags, SeqState};
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use tokio_util::sync::CancellationToken;

use super::stream::{self, Chunk, ReplyFilter, Utf8Assembler};
use super::template::{ChatMessage, ChatTemplate};
use crate::models::catalog::SamplingDefaults;

/// Tokens fed to the model per decode call while reading the prompt. Also
/// the granularity of cancellation and progress reports during that phase.
const PROMPT_BATCH: usize = 256;
/// Room kept free in the context for template tokens that are not counted
/// precisely (the generation prompt, an end-of-turn token).
const CONTEXT_MARGIN: usize = 16;
/// Extra reply budget when the model reasons before answering, so thinking
/// does not use up the whole reply.
const REASONING_BUDGET: u32 = 1024;
/// Snapshots kept per conversation (see [`Checkpoint`]). One is taken per
/// turn; a few are kept so editing a recent message can still rewind.
const MAX_CHECKPOINTS: usize = 4;
/// After history has to be trimmed, trim down to this share of the budget
/// rather than to the brim. The next several turns then fit without
/// trimming again, which keeps the processed-token cache valid.
const TRIM_TARGET_PERCENT: usize = 70;

/// Why generation ended. Sent to the UI so it can tell a finished answer
/// from one that was cut short.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StopReason {
    /// The model ended its turn.
    Eos,
    /// The reply hit the token limit, or the context window is full.
    Length,
    /// The user pressed stop.
    Cancelled,
    /// The model fell into an endless loop.
    Repetition,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", content = "data")]
pub enum InferenceEvent {
    /// The conversation is being read. Sent before the first word when
    /// there is enough new text for the wait to be noticeable.
    PromptProgress { processed: usize, total: usize },
    /// A piece of the model's reasoning (shown collapsed).
    ReasoningGenerated { token: String },
    /// A piece of the answer.
    TokenGenerated { token: String, tokens_per_second: f32 },
    GenerationComplete {
        total_tokens: usize,
        duration_ms: u64,
        stop_reason: StopReason,
        /// Size of the prompt, and how much of it was already cached.
        prompt_tokens: usize,
        cached_tokens: usize,
        /// Time spent reading the prompt before the first token.
        prompt_ms: u64,
    },
    ContextTrimmed { pairs_dropped: usize },
    Error { message: String },
}

/// Figures from one generation, for the speed test and the logs.
#[derive(Debug, Clone, Default, Serialize)]
pub struct GenerationStats {
    pub prompt_tokens: usize,
    pub cached_tokens: usize,
    pub prompt_ms: u64,
    pub generated_tokens: usize,
    pub generation_ms: u64,
}

pub struct GenerationRequest {
    pub system_prompt: String,
    /// Earlier (user, assistant) exchanges, oldest first.
    pub history: Vec<(String, String)>,
    pub user_message: String,
    /// Text the assistant already produced for this turn; generation
    /// continues it instead of starting a new reply.
    pub assistant_prefix: Option<String>,
    pub max_tokens: u32,
    pub temperature: f32,
    pub top_p: f32,
    /// Ask the model to reason first. Ignored by models that cannot.
    pub enable_thinking: bool,
}

pub struct LoadOptions {
    /// Context window to allocate, in tokens.
    pub context_length: u32,
    pub threads: u32,
}

/// The model plus the context created from it.
struct Session {
    // Field order matters: fields drop in declaration order, and the context
    // must be freed before the model it points into.
    ctx: LlamaContext<'static>,
    model: Box<LlamaModel>,
}

/// Remembers how much history was cut for the current conversation, so the
/// same cut is applied on the next turn. Re-deciding from scratch each time
/// would move the cut point and force the whole prompt to be re-read.
struct TrimState {
    conversation: u64,
    dropped: usize,
}

/// A snapshot of the model's running state after `pos` tokens.
///
/// A plain transformer can forget the tail of what it has read: its memory
/// is a list of per-token entries, and the last ones are simply dropped.
/// Hybrid and recurrent models (Qwen 3.5, LFM 2) fold everything they read
/// into one running state, which cannot be "un-read". To go back they need
/// a copy of that state from the point to return to.
struct Checkpoint {
    pos: usize,
    state: SeqState,
}

pub struct LoadedModel {
    pub id: String,
    pub context_length: usize,
    pub threads: u32,
    session: Session,
    template: ChatTemplate,
    sampling: SamplingDefaults,
    /// Exactly the tokens the context currently holds, in order.
    cached: Vec<LlamaToken>,
    trim: Option<TrimState>,
    /// Whether this model needs [`Checkpoint`]s to rewind.
    checkpointing: bool,
    /// Snapshots along `cached`, oldest (smallest `pos`) first.
    checkpoints: Vec<Checkpoint>,
}

/// llama.cpp writes its log to stderr, which nobody sees on a phone. Forward
/// warnings and errors to the app log, where a failed model load can be
/// diagnosed, and drop the (very chatty) informational output.
unsafe extern "C" fn forward_log(
    level: llama_cpp_sys_2::ggml_log_level,
    text: *const c_char,
    _user_data: *mut c_void,
) {
    if text.is_null() {
        return;
    }
    // SAFETY: llama.cpp passes a valid NUL-terminated string that lives for
    // the duration of this call.
    let message = unsafe { CStr::from_ptr(text) }.to_string_lossy();
    let message = message.trim_end();
    if message.is_empty() {
        return;
    }
    if level == llama_cpp_sys_2::GGML_LOG_LEVEL_ERROR {
        error!("llama.cpp: {message}");
    } else if level == llama_cpp_sys_2::GGML_LOG_LEVEL_WARN {
        warn!("llama.cpp: {message}");
    }
}

fn backend() -> Result<&'static LlamaBackend, String> {
    static BACKEND: OnceLock<Result<LlamaBackend, String>> = OnceLock::new();
    BACKEND
        .get_or_init(|| {
            // SAFETY: `forward_log` is a plain function with static lifetime
            // and uses no user data.
            unsafe { llama_cpp_sys_2::llama_log_set(Some(forward_log), std::ptr::null_mut()) };
            LlamaBackend::init().map_err(|e| format!("Could not start the inference engine: {e}"))
        })
        .as_ref()
        .map_err(Clone::clone)
}

/// Text of a special token such as BOS, or "" when the model has none.
fn special_token_text(model: &LlamaModel, token: LlamaToken) -> String {
    let vocab = model.vocab();
    if token.0 < 0 || token.0 >= vocab.n_tokens() {
        return String::new();
    }
    String::from_utf8_lossy(&vocab.token_to_piece(token, true, None)).into_owned()
}

pub fn load_model_from_disk(
    model_id: &str,
    model_path: &Path,
    sampling: SamplingDefaults,
    options: LoadOptions,
) -> Result<LoadedModel, String> {
    let backend = backend()?;
    let started = Instant::now();

    info!("Loading {model_id} from {model_path:?}");
    // Defaults: memory-mapped file, CPU only.
    let model_params = LlamaModelParams::default();
    let model = LlamaModel::load_from_file(backend, model_path, &model_params).map_err(|e| {
        format!("This model could not be loaded ({e}). The file may be damaged; delete it and download it again.")
    })?;
    let model = Box::new(model);

    let trained = model.n_ctx_train().max(512);
    let n_ctx = options.context_length.clamp(512, trained);
    let threads = options.threads.clamp(1, 32) as i32;

    let ctx_params = LlamaContextParams::default()
        .with_n_ctx(NonZeroU32::new(n_ctx))
        .with_n_batch(PROMPT_BATCH as u32)
        .with_n_threads(threads)
        .with_n_threads_batch(threads);

    // SAFETY: the context borrows the model. The model lives in a Box whose
    // heap address never changes, both are owned by the same `Session`, and
    // `Session` declares `ctx` first so it is dropped before the model.
    let model_ref: &'static LlamaModel = unsafe { &*(model.as_ref() as *const LlamaModel) };
    let ctx = model_ref.new_context(backend, ctx_params).map_err(|e| {
        format!("Not enough memory to start this model ({e}). Close other apps or choose a smaller model.")
    })?;
    let context_length = ctx.n_ctx() as usize;

    let vocab = model.vocab();
    let template_source = model.chat_template(None).ok().and_then(|t| t.to_string().ok());
    if template_source.is_none() {
        warn!("{model_id} has no chat template; falling back to ChatML");
    }
    let template = ChatTemplate::new(
        template_source,
        special_token_text(&model, vocab.bos()),
        special_token_text(&model, vocab.eos()),
    );

    let checkpointing = model.is_recurrent() || model.is_hybrid();
    info!(
        "Loaded {model_id} in {} ms: context {context_length} tokens, {threads} threads{}",
        started.elapsed().as_millis(),
        if checkpointing { ", rewinds by snapshot" } else { "" }
    );

    Ok(LoadedModel {
        id: model_id.to_string(),
        context_length,
        threads: threads as u32,
        session: Session { ctx, model },
        template,
        sampling,
        cached: Vec::new(),
        trim: None,
        checkpointing,
        checkpoints: Vec::new(),
    })
}

/// A cheap, stable fingerprint of a conversation: its first user message.
fn conversation_key(history: &[(String, String)], user_message: &str) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    history.first().map(|(user, _)| user.as_str()).unwrap_or(user_message).hash(&mut hasher);
    hasher.finish()
}

fn common_prefix(a: &[LlamaToken], b: &[LlamaToken]) -> usize {
    a.iter().zip(b).take_while(|(x, y)| x == y).count()
}

/// Send filtered reply text to the UI.
fn deliver(
    chunks: &mut Vec<Chunk>,
    generated: usize,
    started: Instant,
    emit: &mut dyn FnMut(InferenceEvent),
) {
    for chunk in chunks.drain(..) {
        match chunk {
            Chunk::Reasoning(token) => emit(InferenceEvent::ReasoningGenerated { token }),
            Chunk::Answer(token) => {
                let tokens_per_second =
                    generated as f32 / started.elapsed().as_secs_f32().max(0.001);
                emit(InferenceEvent::TokenGenerated { token, tokens_per_second });
            }
        }
    }
}

struct Prompt {
    text: String,
    tokens: Vec<LlamaToken>,
    /// How many leading tokens are the conversation itself, before the
    /// "assistant starts here" marker. The next turn's prompt begins with
    /// exactly these tokens, which makes this the place to snapshot.
    stable_len: usize,
}

impl LoadedModel {
    /// Whether this model can be asked to reason before answering.
    pub fn supports_thinking_switch(&self) -> bool {
        self.template.supports_thinking_switch()
    }

    fn render(
        &self,
        request: &GenerationRequest,
        history: &[(String, String)],
        add_generation_prompt: bool,
    ) -> Result<String, String> {
        let system = request.system_prompt.trim();
        let mut messages = Vec::with_capacity(history.len() * 2 + 2);
        if !system.is_empty() {
            messages.push(ChatMessage::system(system));
        }
        for (user, assistant) in history {
            messages.push(ChatMessage::user(user.as_str()));
            messages.push(ChatMessage::assistant(assistant.as_str()));
        }
        messages.push(ChatMessage::user(request.user_message.as_str()));

        let thinking = request.enable_thinking;
        let rendered = match self.template.render(&messages, add_generation_prompt, thinking) {
            Ok(text) => text,
            // A few templates reject a system role outright. Fold the
            // instructions into the first user turn and try again.
            Err(first_error) if !system.is_empty() => {
                let mut merged = messages[1..].to_vec();
                merged[0].content = format!("{system}\n\n{}", merged[0].content);
                self.template
                    .render(&merged, add_generation_prompt, thinking)
                    .map_err(|_| first_error)?
            }
            Err(e) => return Err(e),
        };

        Ok(match request.assistant_prefix.as_deref() {
            Some(prefix) if add_generation_prompt => rendered + prefix,
            _ => rendered,
        })
    }

    fn tokenize(&self, text: &str) -> Vec<LlamaToken> {
        // Templates usually write the BOS token themselves. Only let the
        // tokenizer add one when the text does not already start with it —
        // a doubled BOS measurably degrades answers.
        let bos = self.template.bos_token();
        let add_special = bos.is_empty() || !text.starts_with(bos);
        self.session.model.vocab().tokenize(text.as_bytes(), add_special, true)
    }

    fn prompt_for(
        &self,
        request: &GenerationRequest,
        history: &[(String, String)],
    ) -> Result<Prompt, String> {
        let text = self.render(request, history, true)?;
        let tokens = self.tokenize(&text);
        // The same conversation without the assistant marker. Templates
        // that cannot render that way simply get no snapshot point.
        let stable_len = self
            .render(request, history, false)
            .map(|stable| common_prefix(&self.tokenize(&stable), &tokens))
            .unwrap_or(0);
        Ok(Prompt { text, tokens, stable_len })
    }

    /// Build the prompt, dropping the oldest exchanges if the conversation
    /// no longer fits. Returns the prompt and how many exchanges were cut.
    fn fit_prompt(
        &mut self,
        request: &GenerationRequest,
        max_tokens: usize,
    ) -> Result<(Prompt, usize), String> {
        let budget = self.context_length.saturating_sub(max_tokens + CONTEXT_MARGIN);
        let key = conversation_key(&request.history, &request.user_message);

        // Start from the cut made on an earlier turn of this conversation.
        let mut dropped = match &self.trim {
            Some(state) if state.conversation == key => state.dropped.min(request.history.len()),
            _ => 0,
        };

        let mut prompt = self.prompt_for(request, &request.history[dropped..])?;
        if prompt.tokens.len() > budget {
            let target = budget * TRIM_TARGET_PERCENT / 100;
            while prompt.tokens.len() > target && dropped < request.history.len() {
                dropped += 1;
                prompt = self.prompt_for(request, &request.history[dropped..])?;
            }
            // Cutting to the lower target was a courtesy to the cache; what
            // must hold is the budget itself.
            if prompt.tokens.len() > budget {
                return Err(format!(
                    "That message is too long for this model: it is about {} tokens and {} fit. Shorten it or split it into parts.",
                    prompt.tokens.len(),
                    budget
                ));
            }
            info!(
                "Context trimmed: dropped {dropped} of {} exchanges, prompt is {} of {} tokens",
                request.history.len(),
                prompt.tokens.len(),
                self.context_length
            );
        }

        self.trim = Some(TrimState { conversation: key, dropped });
        Ok((prompt, dropped))
    }

    fn sampler(&self, request: &GenerationRequest) -> LlamaSampler {
        let s = self.sampling;
        let mut chain = Vec::new();
        if (s.repeat_penalty - 1.0).abs() > f32::EPSILON {
            chain.push(LlamaSampler::penalties(
                self.session.model.n_vocab(),
                64,
                s.repeat_penalty,
                0.0,
                0.0,
            ));
        }
        if request.temperature <= 0.0 {
            chain.push(LlamaSampler::greedy());
            return LlamaSampler::chain_simple(chain);
        }
        if s.top_k > 0 {
            chain.push(LlamaSampler::top_k(s.top_k));
        }
        if request.top_p < 1.0 {
            chain.push(LlamaSampler::top_p(request.top_p, 1));
        }
        if s.min_p > 0.0 {
            chain.push(LlamaSampler::min_p(s.min_p, 1));
        }
        chain.push(LlamaSampler::temp(request.temperature));
        let seed = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.subsec_nanos() ^ (d.as_secs() as u32))
            .unwrap_or(0x5eed);
        chain.push(LlamaSampler::dist(seed));
        LlamaSampler::chain_simple(chain)
    }

    /// Forget everything the context has processed.
    fn reset_context(&mut self) {
        self.session.ctx.clear_kv_cache();
        self.cached.clear();
        self.checkpoints.clear();
    }

    /// Make the context forget everything after the first `target` tokens.
    /// Returns how many tokens it still holds, which is `target` or less.
    fn rewind_to(&mut self, target: usize) -> usize {
        if self.session.ctx.kv_cache_seq_rm(0, Some(target as u32), None).is_ok() {
            self.cached.truncate(target);
            self.checkpoints.retain(|c| c.pos <= target);
            return target;
        }

        // The model cannot rewind part-way (the call above changed nothing).
        // Go back to the latest snapshot at or before the target instead.
        self.checkpointing = true;
        if let Some(index) = self.checkpoints.iter().rposition(|c| c.pos <= target) {
            self.checkpoints.truncate(index + 1);
            let checkpoint = &self.checkpoints[index];
            let pos = checkpoint.pos;
            let restored = self.session.ctx.state_seq_set(&checkpoint.state, 0).is_ok()
                && self.session.ctx.kv_cache_seq_rm(0, Some(pos as u32), None).is_ok();
            if restored {
                self.cached.truncate(pos);
                return pos;
            }
            warn!("Could not restore the snapshot at {pos} tokens; re-reading the conversation");
        }

        self.reset_context();
        0
    }

    /// Remember the model's state at the current position.
    fn save_checkpoint(&mut self) {
        let pos = self.cached.len();
        if self.checkpoints.iter().any(|c| c.pos == pos) {
            return;
        }
        match self.session.ctx.state_seq_get(0, LlamaStateSeqFlags::PARTIAL_ONLY) {
            Ok(state) => {
                info!("Snapshot at {pos} tokens ({} KB)", state.byte_len() / 1024);
                self.checkpoints.push(Checkpoint { pos, state });
                if self.checkpoints.len() > MAX_CHECKPOINTS {
                    self.checkpoints.remove(0);
                }
            }
            Err(e) => warn!("Could not snapshot the model state: {e}"),
        }
    }

    /// Bring the context to hold exactly the prompt's tokens, re-using
    /// whatever prefix it has already processed. Returns how many tokens
    /// were re-used, or `None` if the user cancelled part-way.
    fn ingest(
        &mut self,
        prompt: &Prompt,
        emit: &mut dyn FnMut(InferenceEvent),
        cancel: &CancellationToken,
    ) -> Result<Option<usize>, String> {
        let tokens = prompt.tokens.as_slice();
        // Always decode at least the final token: sampling needs its logits.
        let mut reused = common_prefix(&self.cached, tokens).min(tokens.len() - 1);
        if reused < self.cached.len() {
            reused = self.rewind_to(reused);
        }

        let total = tokens.len() - reused;
        let report_progress = total > PROMPT_BATCH;
        // Stop at the snapshot point on the way, if it is still ahead.
        let snapshot_at = (self.checkpointing
            && prompt.stable_len > reused
            && prompt.stable_len < tokens.len())
        .then_some(prompt.stable_len);

        let mut batch = LlamaBatch::new(PROMPT_BATCH, 1);
        while self.cached.len() < tokens.len() {
            if cancel.is_cancelled() {
                return Ok(None);
            }
            let from = self.cached.len();
            let limit = match snapshot_at {
                Some(at) if from < at => at,
                _ => tokens.len(),
            };
            let to = (from + PROMPT_BATCH).min(limit);

            batch.clear();
            for (position, token) in tokens.iter().enumerate().take(to).skip(from) {
                batch
                    .add(*token, position as i32, &[0], position + 1 == tokens.len())
                    .map_err(|e| format!("Could not queue the prompt: {e}"))?;
            }
            if let Err(e) = self.session.ctx.decode(&mut batch) {
                // The context may hold part of the batch; start clean next time.
                self.reset_context();
                return Err(format!("The model failed while reading the conversation: {e}"));
            }
            self.cached.extend_from_slice(&tokens[from..to]);

            if snapshot_at == Some(to) {
                self.save_checkpoint();
            }
            if report_progress {
                emit(InferenceEvent::PromptProgress { processed: to - reused, total });
            }
        }

        Ok(Some(reused))
    }

    /// Generate a reply, streaming it through `emit`.
    pub fn generate(
        &mut self,
        request: &GenerationRequest,
        emit: &mut dyn FnMut(InferenceEvent),
        cancel: &CancellationToken,
    ) -> Result<GenerationStats, String> {
        let mut max_tokens = request.max_tokens.max(16);
        if request.enable_thinking && self.supports_thinking_switch() {
            max_tokens += REASONING_BUDGET;
        }
        // Never let the reply budget swallow the whole context window.
        let max_tokens = (max_tokens as usize).min(self.context_length / 2);

        let (prompt, dropped) = self.fit_prompt(request, max_tokens)?;
        if dropped > 0 {
            emit(InferenceEvent::ContextTrimmed { pairs_dropped: dropped });
        }
        if prompt.tokens.is_empty() {
            return Err("The prompt is empty.".to_string());
        }

        let prompt_started = Instant::now();
        let mut stats = GenerationStats { prompt_tokens: prompt.tokens.len(), ..Default::default() };

        let Some(reused) = self.ingest(&prompt, emit, cancel)? else {
            emit(InferenceEvent::GenerationComplete {
                total_tokens: 0,
                duration_ms: 0,
                stop_reason: StopReason::Cancelled,
                prompt_tokens: stats.prompt_tokens,
                cached_tokens: 0,
                prompt_ms: prompt_started.elapsed().as_millis() as u64,
            });
            return Ok(stats);
        };
        stats.cached_tokens = reused;
        stats.prompt_ms = prompt_started.elapsed().as_millis() as u64;

        let mut sampler = self.sampler(request);
        let mut batch = LlamaBatch::new(1, 1);
        let mut assembler = Utf8Assembler::default();
        let mut filter = ReplyFilter::new(stream::prompt_opens_reasoning(&prompt.text));
        let mut chunks: Vec<Chunk> = Vec::new();
        let mut generated: Vec<i32> = Vec::with_capacity(max_tokens);
        let mut answer_tokens = 0usize;
        let started = Instant::now();

        let stop_reason = loop {
            let token = sampler.sample(&self.session.ctx, -1);
            let vocab = self.session.model.vocab();
            if vocab.is_eog(token) {
                break StopReason::Eos;
            }
            generated.push(token.0);

            // Control tokens are template plumbing and never shown — except
            // the reasoning tags, which the filter needs to see.
            let piece = vocab.token_to_piece(token, true, None);
            let hidden = vocab.is_control(token)
                && !stream::is_reasoning_marker(&String::from_utf8_lossy(&piece));
            if !hidden {
                let text = assembler.push(&piece);
                if !text.is_empty() {
                    filter.push(&text, &mut chunks);
                    answer_tokens += 1;
                    deliver(&mut chunks, generated.len(), started, &mut *emit);
                }
            }

            if generated.len() >= max_tokens || self.cached.len() >= self.context_length {
                break StopReason::Length;
            }
            if cancel.is_cancelled() {
                break StopReason::Cancelled;
            }
            if generated.len() % 32 == 0 && stream::is_stuck(&generated) {
                info!("Stopping: the model is looping after {} tokens", generated.len());
                break StopReason::Repetition;
            }

            batch.clear();
            batch
                .add(token, self.cached.len() as i32, &[0], true)
                .map_err(|e| format!("Could not queue a token: {e}"))?;
            if let Err(e) = self.session.ctx.decode(&mut batch) {
                self.reset_context();
                return Err(format!("The model failed while writing: {e}"));
            }
            self.cached.push(token);
        };

        assembler.reset();
        filter.finish(&mut chunks);
        deliver(&mut chunks, generated.len(), started, &mut *emit);

        stats.generated_tokens = generated.len();
        stats.generation_ms = started.elapsed().as_millis() as u64;
        info!(
            "Reply: {} tokens ({answer_tokens} shown) in {} ms; prompt {} tokens, {} cached, read in {} ms; stop {:?}",
            stats.generated_tokens,
            stats.generation_ms,
            stats.prompt_tokens,
            stats.cached_tokens,
            stats.prompt_ms,
            stop_reason
        );

        emit(InferenceEvent::GenerationComplete {
            total_tokens: stats.generated_tokens,
            duration_ms: stats.generation_ms,
            stop_reason,
            prompt_tokens: stats.prompt_tokens,
            cached_tokens: stats.cached_tokens,
            prompt_ms: stats.prompt_ms,
        });
        Ok(stats)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn conversations_are_keyed_by_their_first_message() {
        let first = vec![("hello".to_string(), "hi".to_string())];
        let longer = vec![
            ("hello".to_string(), "hi".to_string()),
            ("more".to_string(), "sure".to_string()),
        ];
        assert_eq!(conversation_key(&first, "x"), conversation_key(&longer, "y"));
        assert_ne!(conversation_key(&first, "x"), conversation_key(&[], "x"));
        // A brand-new chat is keyed by the message being sent, which becomes
        // the first history entry on the next turn.
        assert_eq!(conversation_key(&[], "hello"), conversation_key(&first, "next"));
    }

    /// Collects what a generation streamed.
    #[derive(Default)]
    struct Transcript {
        answer: String,
        reasoning: String,
        stop: Option<StopReason>,
    }

    fn run(model: &mut LoadedModel, request: &GenerationRequest) -> (Transcript, GenerationStats) {
        let cancel = CancellationToken::new();
        let mut transcript = Transcript::default();
        let stats = model
            .generate(
                request,
                &mut |event: InferenceEvent| match event {
                    InferenceEvent::TokenGenerated { token, .. } => transcript.answer.push_str(&token),
                    InferenceEvent::ReasoningGenerated { token } => {
                        transcript.reasoning.push_str(&token)
                    }
                    InferenceEvent::GenerationComplete { stop_reason, .. } => {
                        transcript.stop = Some(stop_reason)
                    }
                    _ => {}
                },
                &cancel,
            )
            .expect("generation failed");
        (transcript, stats)
    }

    /// End-to-end check against a real GGUF: load, answer, follow up, think,
    /// cancel. Skipped unless `NEURIX_TEST_MODEL` points at a model file; CI
    /// downloads small ones and runs this with `--ignored --nocapture`.
    #[test]
    #[ignore = "needs a model file: set NEURIX_TEST_MODEL"]
    fn real_model_end_to_end() {
        let path = std::env::var("NEURIX_TEST_MODEL").expect("NEURIX_TEST_MODEL is not set");
        let sampling = SamplingDefaults { top_k: 40, min_p: 0.05, repeat_penalty: 1.0 };
        let options = LoadOptions { context_length: 2048, threads: 2 };
        let mut model = load_model_from_disk("test", Path::new(&path), sampling, options)
            .expect("model failed to load");
        println!(
            "context {} tokens, thinking switch: {}, rewinds by snapshot: {}",
            model.context_length,
            model.supports_thinking_switch(),
            model.checkpointing
        );

        let mut request = GenerationRequest {
            system_prompt: "You are a helpful assistant. Answer in one short sentence.".into(),
            history: Vec::new(),
            user_message: "What is the capital of France?".into(),
            assistant_prefix: None,
            max_tokens: 64,
            // Greedy, so the run is repeatable.
            temperature: 0.0,
            top_p: 1.0,
            enable_thinking: false,
        };

        // First turn: nothing cached, a clean answer.
        let (first, stats) = run(&mut model, &request);
        println!("Q1 -> {:?} | reasoning {:?} | {stats:?}", first.answer, first.reasoning);
        assert_eq!(stats.cached_tokens, 0);
        assert!(first.answer.to_lowercase().contains("paris"), "answer: {:?}", first.answer);
        for leak in ["<|", "|>", "<think>", "</think>", "<start_of_turn>", "<end_of_turn>"] {
            assert!(!first.answer.contains(leak), "template token leaked: {:?}", first.answer);
        }
        assert_ne!(first.stop, Some(StopReason::Repetition));

        // Second turn: the first exchange must come from the cache.
        request.history.push((request.user_message.clone(), first.answer.clone()));
        request.user_message = "And what is the capital of Italy?".into();
        let (second, stats2) = run(&mut model, &request);
        println!("Q2 -> {:?} | {stats2:?}", second.answer);
        assert!(second.answer.to_lowercase().contains("rome"), "answer: {:?}", second.answer);
        assert!(
            stats2.cached_tokens * 2 > stats.prompt_tokens,
            "follow-up re-read the conversation: {stats2:?} after {stats:?}"
        );

        // Asking the same question again (the "Retry" button) re-reads at
        // most the tail of the prompt.
        let (again, stats3) = run(&mut model, &request);
        println!("retry -> {:?} | {stats3:?}", again.answer);
        assert!(again.answer.to_lowercase().contains("rome"), "answer: {:?}", again.answer);
        assert!(
            stats3.cached_tokens * 2 > stats3.prompt_tokens,
            "retry re-read the conversation: {stats3:?}"
        );

        // Continuing a reply appends to it rather than starting over.
        request.assistant_prefix = Some("The capital of Italy is".into());
        let (continued, _) = run(&mut model, &request);
        println!("continue -> {:?}", continued.answer);
        assert!(continued.answer.to_lowercase().contains("rome"), "answer: {:?}", continued.answer);
        request.assistant_prefix = None;

        // Reasoning, where the model can be asked for it.
        if model.supports_thinking_switch() {
            request.enable_thinking = true;
            request.max_tokens = 256;
            let (thought, _) = run(&mut model, &request);
            println!("thinking -> reasoning {:?} | answer {:?}", thought.reasoning, thought.answer);
            assert!(!thought.answer.contains("</think>"), "answer: {:?}", thought.answer);
            assert!(!thought.answer.contains("<channel|>"), "answer: {:?}", thought.answer);
            request.enable_thinking = false;
        }

        // A message that cannot fit is refused with an explanation.
        let mut huge = GenerationRequest {
            system_prompt: String::new(),
            history: Vec::new(),
            user_message: "word ".repeat(6000),
            assistant_prefix: None,
            max_tokens: 64,
            temperature: 0.0,
            top_p: 1.0,
            enable_thinking: false,
        };
        let cancel = CancellationToken::new();
        let refused = model.generate(&huge, &mut |_: InferenceEvent| {}, &cancel).unwrap_err();
        assert!(refused.contains("too long"), "{refused}");

        // Cancelling before the prompt is read stops cleanly, and the model
        // still works afterwards.
        huge.user_message = "Tell me about mountains. ".repeat(60);
        let cancelled = CancellationToken::new();
        cancelled.cancel();
        let mut stop = None;
        model
            .generate(
                &huge,
                &mut |event: InferenceEvent| {
                    if let InferenceEvent::GenerationComplete { stop_reason, .. } = event {
                        stop = Some(stop_reason);
                    }
                },
                &cancelled,
            )
            .expect("cancelled generation returned an error");
        assert_eq!(stop, Some(StopReason::Cancelled));

        request.history.clear();
        request.user_message = "Reply with the single word: ready".into();
        let (after, _) = run(&mut model, &request);
        println!("after cancel -> {:?}", after.answer);
        assert!(!after.answer.trim().is_empty());
    }

    #[test]
    fn shared_prefix_is_measured_in_tokens() {
        let t = |ids: &[i32]| ids.iter().map(|i| LlamaToken(*i)).collect::<Vec<_>>();
        assert_eq!(common_prefix(&t(&[1, 2, 3]), &t(&[1, 2, 4, 5])), 2);
        assert_eq!(common_prefix(&t(&[]), &t(&[1])), 0);
        assert_eq!(common_prefix(&t(&[1, 2]), &t(&[1, 2])), 2);
    }
}
