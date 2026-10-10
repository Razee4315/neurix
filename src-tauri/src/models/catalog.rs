use serde::{Deserialize, Serialize};

/// Whether a model reasons ("thinks") before it answers.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Reasoning {
    /// Answers directly.
    None,
    /// Can think first when asked to; off by default because it is slower.
    Optional,
    /// Always thinks first.
    Always,
}

/// Sampling settings the model's authors recommend, beyond the temperature
/// and top-p that a character chooses.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct SamplingDefaults {
    pub top_k: i32,
    pub min_p: f32,
    /// 1.0 disables the penalty. Larger models do not need one, and it
    /// damages code, tables and lists, where repeating tokens is correct.
    pub repeat_penalty: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub size_bytes: u64,
    pub size_label: String,
    /// One of "Tiny", "Fast", "Balanced", "Smart" — or "Legacy".
    pub tag: String,
    pub hf_repo: String,
    pub hf_filename: String,
    /// SHA-256 of the GGUF, checked after download. `None` for older
    /// entries, which fall back to the hash HuggingFace sends.
    pub sha256: Option<String>,
    pub company: String,
    pub parameters: String,
    pub quantization: String,
    pub best_for: Vec<String>,
    /// Context window the app asks for, in tokens. The loader lowers it on
    /// low-memory devices and never exceeds what the model was trained for.
    pub context_length: usize,
    /// Device RAM, in GB, the model needs to run comfortably.
    pub min_ram_gb: u32,
    /// Rough answer quality relative to the rest of the catalog, 1–5.
    pub quality: u8,
    /// Rough speed relative to the rest of the catalog, 1–5.
    pub speed: u8,
    pub reasoning: Reasoning,
    /// Year and month of release ("2026-02").
    pub released: String,
    /// Superseded models: still runnable if already installed, but no
    /// longer offered in the store.
    pub legacy: bool,
    pub sampling: SamplingDefaults,
}

const QWEN: SamplingDefaults = SamplingDefaults { top_k: 20, min_p: 0.0, repeat_penalty: 1.0 };
const QWEN_TINY: SamplingDefaults = SamplingDefaults { top_k: 20, min_p: 0.0, repeat_penalty: 1.05 };
const GEMMA: SamplingDefaults = SamplingDefaults { top_k: 64, min_p: 0.0, repeat_penalty: 1.0 };
const LFM: SamplingDefaults = SamplingDefaults { top_k: 50, min_p: 0.15, repeat_penalty: 1.05 };
const GENERIC: SamplingDefaults = SamplingDefaults { top_k: 40, min_p: 0.05, repeat_penalty: 1.0 };
const GENERIC_TINY: SamplingDefaults = SamplingDefaults { top_k: 40, min_p: 0.05, repeat_penalty: 1.05 };

fn strings(items: &[&str]) -> Vec<String> {
    items.iter().map(|s| s.to_string()).collect()
}

pub fn get_catalog() -> Vec<ModelInfo> {
    let mut models = current();
    models.extend(legacy());
    models
}

/// Models offered in the store, smallest first.
fn current() -> Vec<ModelInfo> {
    vec![
        ModelInfo {
            id: "qwen-3.5-0.8b".into(),
            name: "Qwen 3.5 0.8B".into(),
            description: "The smallest model that still holds a real conversation. Starts instantly and runs on almost any phone; best for quick questions, rewording and short summaries.".into(),
            size_bytes: 639_029_504,
            size_label: "640 MB".into(),
            tag: "Tiny".into(),
            hf_repo: "unsloth/Qwen3.5-0.8B-GGUF".into(),
            hf_filename: "Qwen3.5-0.8B-Q6_K.gguf".into(),
            sha256: Some("8408c5c222111cec253682b49eece2a02ed641ded68490001ec4ee160e71098e".into()),
            company: "Alibaba".into(),
            parameters: "0.8B".into(),
            quantization: "Q6_K (6-bit)".into(),
            best_for: strings(&["Quick answers", "Older phones", "Many languages"]),
            context_length: 8192,
            min_ram_gb: 3,
            quality: 2,
            speed: 5,
            reasoning: Reasoning::Optional,
            released: "2026-02".into(),
            legacy: false,
            sampling: QWEN_TINY,
        },
        ModelInfo {
            id: "lfm-2.5-1.2b".into(),
            name: "LFM 2.5 1.2B".into(),
            description: "Liquid AI's model built specifically for phones. Very fast for its quality, and good at following instructions and pulling facts out of text.".into(),
            size_bytes: 843_354_944,
            size_label: "840 MB".into(),
            tag: "Fast".into(),
            hf_repo: "LiquidAI/LFM2.5-1.2B-Instruct-GGUF".into(),
            hf_filename: "LFM2.5-1.2B-Instruct-Q5_K_M.gguf".into(),
            sha256: Some("fa03f3ac4da941a53a0cd4450aacf6a80804c6a1ff885d2fdcbe9406c03215c4".into()),
            company: "Liquid AI".into(),
            parameters: "1.2B".into(),
            quantization: "Q5_K_M (5-bit)".into(),
            best_for: strings(&["Fast replies", "Summaries", "Following instructions"]),
            context_length: 8192,
            min_ram_gb: 3,
            quality: 2,
            speed: 5,
            reasoning: Reasoning::None,
            released: "2026-01".into(),
            legacy: false,
            sampling: LFM,
        },
        ModelInfo {
            id: "qwen-3.5-2b".into(),
            name: "Qwen 3.5 2B".into(),
            description: "The best all-rounder for most phones. Clear writing, solid general knowledge and strong multilingual support, and it can think a problem through when you ask it to.".into(),
            size_bytes: 1_280_835_840,
            size_label: "1.3 GB".into(),
            tag: "Balanced".into(),
            hf_repo: "unsloth/Qwen3.5-2B-GGUF".into(),
            hf_filename: "Qwen3.5-2B-Q4_K_M.gguf".into(),
            sha256: Some("aaf42c8b7c3cab2bf3d69c355048d4a0ee9973d48f16c731c0520ee914699223".into()),
            company: "Alibaba".into(),
            parameters: "2B".into(),
            quantization: "Q4_K_M (4-bit)".into(),
            best_for: strings(&["Everyday chat", "Writing help", "Many languages"]),
            context_length: 8192,
            min_ram_gb: 4,
            quality: 3,
            speed: 4,
            reasoning: Reasoning::Optional,
            released: "2026-02".into(),
            legacy: false,
            sampling: QWEN,
        },
        ModelInfo {
            id: "lfm-2.5-2.6b".into(),
            name: "LFM 2.5 2.6B".into(),
            description: "A reasoning model that works through a question step by step before it answers. Slower to start replying, but more careful with logic, maths and multi-step tasks.".into(),
            size_bytes: 1_674_455_040,
            size_label: "1.7 GB".into(),
            tag: "Balanced".into(),
            hf_repo: "LiquidAI/LFM2.5-2.6B-GGUF".into(),
            hf_filename: "LFM2.5-2.6B-Q4_K_M.gguf".into(),
            sha256: Some("02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed".into()),
            company: "Liquid AI".into(),
            parameters: "2.6B".into(),
            quantization: "Q4_K_M (4-bit)".into(),
            best_for: strings(&["Step-by-step reasoning", "Maths and logic", "Planning"]),
            context_length: 8192,
            min_ram_gb: 6,
            quality: 4,
            speed: 3,
            reasoning: Reasoning::Always,
            released: "2026-07".into(),
            legacy: false,
            sampling: LFM,
        },
        ModelInfo {
            id: "qwen-3.5-4b".into(),
            name: "Qwen 3.5 4B".into(),
            description: "The most capable model that fits a modern phone. Noticeably better at code, analysis and long answers; needs a recent device with 8 GB of memory.".into(),
            size_bytes: 2_740_937_888,
            size_label: "2.7 GB".into(),
            tag: "Smart".into(),
            hf_repo: "unsloth/Qwen3.5-4B-GGUF".into(),
            hf_filename: "Qwen3.5-4B-Q4_K_M.gguf".into(),
            sha256: Some("00fe7986ff5f6b463e62455821146049db6f9313603938a70800d1fb69ef11a4".into()),
            company: "Alibaba".into(),
            parameters: "4B".into(),
            quantization: "Q4_K_M (4-bit)".into(),
            best_for: strings(&["Code", "Analysis", "Long, detailed answers"]),
            context_length: 8192,
            min_ram_gb: 8,
            quality: 5,
            speed: 2,
            reasoning: Reasoning::Optional,
            released: "2026-02".into(),
            legacy: false,
            sampling: QWEN,
        },
        ModelInfo {
            id: "gemma-4-e2b".into(),
            name: "Gemma 4 E2B".into(),
            description: "Google's on-device model, in the quantization-aware build Google publishes itself. Natural, well-structured writing; a large download for how fast it runs.".into(),
            size_bytes: 3_349_516_256,
            size_label: "3.3 GB".into(),
            tag: "Smart".into(),
            hf_repo: "google/gemma-4-E2B-it-qat-q4_0-gguf".into(),
            hf_filename: "gemma-4-E2B_q4_0-it.gguf".into(),
            sha256: Some("fa401b55b07ee70a54c6dae3903c783a6e65064312529ea57175cb5f8dec6634".into()),
            company: "Google".into(),
            parameters: "2B effective".into(),
            quantization: "Q4_0 (QAT, 4-bit)".into(),
            best_for: strings(&["Natural writing", "Explanations", "Creative work"]),
            context_length: 8192,
            min_ram_gb: 8,
            quality: 4,
            speed: 3,
            reasoning: Reasoning::Optional,
            released: "2026-03".into(),
            legacy: false,
            sampling: GEMMA,
        },
        ModelInfo {
            id: "gemma-4-e4b".into(),
            name: "Gemma 4 E4B".into(),
            description: "The larger Gemma 4. The strongest writing and reasoning in the catalog, but it needs a computer or a phone with 12 GB of memory or more.".into(),
            size_bytes: 5_154_941_280,
            size_label: "5.2 GB".into(),
            tag: "Smart".into(),
            hf_repo: "google/gemma-4-E4B-it-qat-q4_0-gguf".into(),
            hf_filename: "gemma-4-E4B_q4_0-it.gguf".into(),
            sha256: Some("676c35070db6dbe52f93e9c864ee0fba4eddea94b9c875d9cb10daff453fbaee".into()),
            company: "Google".into(),
            parameters: "4B effective".into(),
            quantization: "Q4_0 (QAT, 4-bit)".into(),
            best_for: strings(&["Desktop use", "Hard questions", "Long documents"]),
            context_length: 8192,
            min_ram_gb: 12,
            quality: 5,
            speed: 1,
            reasoning: Reasoning::Optional,
            released: "2026-03".into(),
            legacy: false,
            sampling: GEMMA,
        },
    ]
}

/// A model from an earlier catalog. Kept so that copies people have already
/// downloaded keep working after an update.
#[allow(clippy::too_many_arguments)]
fn old(
    id: &str,
    name: &str,
    company: &str,
    parameters: &str,
    size_bytes: u64,
    size_label: &str,
    hf_repo: &str,
    hf_filename: &str,
    min_ram_gb: u32,
    quality: u8,
    speed: u8,
    sampling: SamplingDefaults,
) -> ModelInfo {
    ModelInfo {
        id: id.into(),
        name: name.into(),
        description: format!(
            "{name} is from an earlier Neurix catalog. It still works, but newer models of the same size give better answers."
        ),
        size_bytes,
        size_label: size_label.into(),
        tag: "Legacy".into(),
        hf_repo: hf_repo.into(),
        hf_filename: hf_filename.into(),
        sha256: None,
        company: company.into(),
        parameters: parameters.into(),
        quantization: "Q4_K_M (4-bit)".into(),
        best_for: strings(&["Already installed"]),
        context_length: 4096,
        min_ram_gb,
        quality,
        speed,
        reasoning: Reasoning::None,
        released: "2024-09".into(),
        legacy: true,
        sampling,
    }
}

fn legacy() -> Vec<ModelInfo> {
    vec![
        old("llama-3.2-1b", "Llama 3.2 1B", "Meta", "1B", 700_000_000, "~700 MB",
            "bartowski/Llama-3.2-1B-Instruct-GGUF", "Llama-3.2-1B-Instruct-Q4_K_M.gguf", 3, 1, 5, GENERIC_TINY),
        old("smollm2-1.7b", "SmolLM2 1.7B", "HuggingFace", "1.7B", 1_000_000_000, "~1.0 GB",
            "bartowski/SmolLM2-1.7B-Instruct-GGUF", "SmolLM2-1.7B-Instruct-Q4_K_M.gguf", 4, 2, 4, GENERIC),
        old("gemma-2-2b", "Gemma 2 2B", "Google", "2B", 1_500_000_000, "~1.5 GB",
            "bartowski/gemma-2-2b-it-GGUF", "gemma-2-2b-it-Q4_K_M.gguf", 4, 2, 4, GEMMA),
        old("llama-3.2-3b", "Llama 3.2 3B", "Meta", "3B", 2_019_377_696, "2.0 GB",
            "bartowski/Llama-3.2-3B-Instruct-GGUF", "Llama-3.2-3B-Instruct-Q4_K_M.gguf", 6, 3, 3, GENERIC),
        old("phi-3.5-mini", "Phi-3.5 Mini", "Microsoft", "3.8B", 2_200_000_000, "~2.2 GB",
            "bartowski/Phi-3.5-mini-instruct-GGUF", "Phi-3.5-mini-instruct-Q4_K_M.gguf", 6, 3, 2, GENERIC),
        old("qwen-2.5-0.5b", "Qwen 2.5 0.5B", "Alibaba", "0.5B", 400_000_000, "~380 MB",
            "bartowski/Qwen2.5-0.5B-Instruct-GGUF", "Qwen2.5-0.5B-Instruct-Q4_K_M.gguf", 2, 1, 5, QWEN_TINY),
        old("qwen-2.5-1.5b", "Qwen 2.5 1.5B", "Alibaba", "1.5B", 990_000_000, "~940 MB",
            "bartowski/Qwen2.5-1.5B-Instruct-GGUF", "Qwen2.5-1.5B-Instruct-Q4_K_M.gguf", 3, 2, 4, QWEN),
        old("qwen-2.5-3b", "Qwen 2.5 3B", "Alibaba", "3B", 1_930_000_000, "~1.8 GB",
            "bartowski/Qwen2.5-3B-Instruct-GGUF", "Qwen2.5-3B-Instruct-Q4_K_M.gguf", 6, 3, 3, QWEN),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn ids_are_unique_and_path_safe() {
        let catalog = get_catalog();
        let ids: HashSet<_> = catalog.iter().map(|m| m.id.as_str()).collect();
        assert_eq!(ids.len(), catalog.len());
        for model in &catalog {
            assert!(
                model.id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.'),
                "{} is used as a directory name",
                model.id
            );
        }
    }

    #[test]
    fn store_models_are_verifiable_and_rated() {
        for model in get_catalog().iter().filter(|m| !m.legacy) {
            let hash = model.sha256.as_deref().expect("store models carry a checksum");
            assert_eq!(hash.len(), 64, "{}", model.id);
            assert!(hash.chars().all(|c| c.is_ascii_hexdigit()), "{}", model.id);
            assert!((1..=5).contains(&model.quality), "{}", model.id);
            assert!((1..=5).contains(&model.speed), "{}", model.id);
            assert!(model.hf_filename.ends_with(".gguf"), "{}", model.id);
            assert!(model.size_bytes > 100_000_000, "{}", model.id);
        }
    }

    #[test]
    fn every_earlier_model_id_still_resolves() {
        let catalog = get_catalog();
        for id in [
            "llama-3.2-1b", "smollm2-1.7b", "gemma-2-2b", "llama-3.2-3b",
            "phi-3.5-mini", "qwen-2.5-0.5b", "qwen-2.5-1.5b", "qwen-2.5-3b",
        ] {
            assert!(catalog.iter().any(|m| m.id == id), "{id} was dropped");
        }
    }
}
