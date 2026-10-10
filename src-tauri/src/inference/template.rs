//! Chat prompt formatting.
//!
//! Every GGUF carries the Jinja chat template its model was trained with.
//! Rendering that template — instead of hand-writing a prompt format per
//! model family — is what keeps special tokens, system-prompt placement and
//! reasoning switches correct for models this app has never seen.

use minijinja::value::Value;
use minijinja::{context, Environment, Error, ErrorKind};
use serde::Serialize;

/// One turn of a conversation, in the shape chat templates expect.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ChatMessage {
    pub role: &'static str,
    pub content: String,
}

impl ChatMessage {
    pub fn system(content: impl Into<String>) -> Self {
        Self { role: "system", content: content.into() }
    }
    pub fn user(content: impl Into<String>) -> Self {
        Self { role: "user", content: content.into() }
    }
    pub fn assistant(content: impl Into<String>) -> Self {
        Self { role: "assistant", content: content.into() }
    }
}

/// A model's chat template plus the token strings it refers to.
#[derive(Debug, Clone)]
pub struct ChatTemplate {
    source: String,
    bos_token: String,
    eos_token: String,
}

/// Used when a GGUF ships no template at all. ChatML is the most widely
/// understood format among small instruction-tuned models.
const CHATML_FALLBACK: &str = "{%- for message in messages -%}\
{{- '<|im_start|>' + message.role + '\\n' + message.content + '<|im_end|>\\n' -}}\
{%- endfor -%}\
{%- if add_generation_prompt -%}{{- '<|im_start|>assistant\\n' -}}{%- endif -%}";

impl ChatTemplate {
    pub fn new(source: Option<String>, bos_token: String, eos_token: String) -> Self {
        let source = match source {
            Some(s) if !s.trim().is_empty() => strip_generation_tags(&s),
            _ => CHATML_FALLBACK.to_string(),
        };
        Self { source, bos_token, eos_token }
    }

    /// Whether the template reads an `enable_thinking` switch, i.e. the
    /// model can reason before answering and lets the caller turn that on.
    pub fn supports_thinking_switch(&self) -> bool {
        self.source.contains("enable_thinking")
    }

    /// Format a conversation into the exact prompt text the model expects.
    /// With `add_generation_prompt` it ends where the assistant's reply
    /// should begin; without, it ends after the last message.
    pub fn render(
        &self,
        messages: &[ChatMessage],
        add_generation_prompt: bool,
        enable_thinking: bool,
    ) -> Result<String, String> {
        let mut env = Environment::new();
        // Hugging Face renders chat templates with these two options on.
        env.set_trim_blocks(true);
        env.set_lstrip_blocks(true);
        // Templates are written for Python's Jinja2 and call str/dict
        // methods such as `.strip()`, `.split()`, `.get()` and `.items()`.
        env.set_unknown_method_callback(minijinja_contrib::pycompat::unknown_method_callback);
        env.add_function("raise_exception", raise_exception);
        env.add_function("strftime_now", strftime_now);

        let template = env
            .template_from_str(&self.source)
            .map_err(|e| format!("Chat template could not be parsed: {e}"))?;
        template
            .render(context! {
                messages => messages,
                add_generation_prompt => add_generation_prompt,
                enable_thinking => enable_thinking,
                bos_token => self.bos_token,
                eos_token => self.eos_token,
            })
            .map_err(|e| format!("Chat template could not be applied: {e}"))
    }

    pub fn bos_token(&self) -> &str {
        &self.bos_token
    }
}

fn raise_exception(message: String) -> Result<Value, Error> {
    Err(Error::new(ErrorKind::InvalidOperation, message))
}

/// `strftime_now("%d %b %Y")`, which some templates use to tell the model
/// today's date.
fn strftime_now(format: String) -> String {
    use std::fmt::Write;
    let mut out = String::new();
    // An unsupported specifier makes chrono's formatter return an error
    // rather than text; fall back to an ISO date instead of failing the
    // whole prompt.
    if write!(out, "{}", chrono::Local::now().format(&format)).is_err() {
        out = chrono::Local::now().format("%Y-%m-%d").to_string();
    }
    out
}

/// Remove `{% generation %}` / `{% endgeneration %}`.
///
/// These are a Hugging Face extension that marks which part of the prompt
/// the assistant wrote (for training masks). They produce no text and are
/// not valid Jinja, so they are turned into comments, keeping any `-`
/// whitespace control they carried.
fn strip_generation_tags(source: &str) -> String {
    let mut out = String::with_capacity(source.len());
    let mut rest = source;
    while let Some(start) = rest.find("{%") {
        let Some(len) = rest[start..].find("%}") else { break };
        let end = start + len + 2;
        let tag = &rest[start..end];
        let inner = tag[2..tag.len() - 2].trim_matches(|c: char| c == '-' || c.is_whitespace());
        out.push_str(&rest[..start]);
        if inner == "generation" || inner == "endgeneration" {
            let lead = if tag.starts_with("{%-") { "{#-" } else { "{#" };
            let trail = if tag.ends_with("-%}") { "-#}" } else { "#}" };
            out.push_str(lead);
            out.push_str(trail);
        } else {
            out.push_str(tag);
        }
        rest = &rest[end..];
    }
    out.push_str(rest);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn chat() -> Vec<ChatMessage> {
        vec![
            ChatMessage::system("Be brief."),
            ChatMessage::user("Hi"),
            ChatMessage::assistant("Hello!"),
            ChatMessage::user("  What is 2+2?  "),
        ]
    }

    #[test]
    fn missing_template_falls_back_to_chatml() {
        let t = ChatTemplate::new(None, String::new(), "<|im_end|>".into());
        let out = t.render(&chat(), true, false).unwrap();
        assert!(out.starts_with("<|im_start|>system\nBe brief.<|im_end|>\n"));
        assert!(out.ends_with("<|im_start|>assistant\n"));
        assert!(!t.supports_thinking_switch());
    }

    /// The Python-isms real templates lean on: reversed slices, namespaces,
    /// str methods, `loop.previtem`, block `set`, and `raise_exception`.
    #[test]
    fn renders_python_flavoured_templates() {
        let src = r#"{{- bos_token -}}
{%- set ns = namespace(last_user=-1) -%}
{%- for message in messages[::-1] -%}
    {%- if ns.last_user == -1 and message.role == "user" -%}
        {%- set ns.last_user = (messages|length - 1) - loop.index0 -%}
    {%- endif -%}
{%- endfor -%}
{%- if messages[0]['role'] == 'system' -%}
    {{- '<sys>' + messages[0]['content'].strip() + '</sys>\n' -}}
    {%- set messages = messages[1:] -%}
{%- endif -%}
{%- for message in messages -%}
    {%- set body -%}
        {{- message.get('content') | trim -}}
    {%- endset -%}
    {%- if message.role == 'assistant' and '</think>' in body -%}
        {%- set body = body.split('</think>')[-1].lstrip('\n') -%}
    {%- endif -%}
    {%- if loop.previtem and loop.previtem.role == message.role -%}
        {{- raise_exception('Roles must alternate.') -}}
    {%- endif -%}
    {{- '<' + message.role + '>' + body + '<end>\n' -}}
{%- endfor -%}
{%- if add_generation_prompt -%}
    {{- '<assistant>' -}}
    {%- if enable_thinking is defined and enable_thinking is true -%}
        {{- '<think>\n' -}}
    {%- endif -%}
{%- endif -%}"#;
        let t = ChatTemplate::new(Some(src.into()), "<s>".into(), "</s>".into());
        assert!(t.supports_thinking_switch());

        let out = t.render(&chat(), true, false).unwrap();
        assert_eq!(
            out,
            "<s><sys>Be brief.</sys>\n<user>Hi<end>\n<assistant>Hello!<end>\n<user>What is 2+2?<end>\n<assistant>"
        );
        assert!(t.render(&chat(), true, true).unwrap().ends_with("<assistant><think>\n"));

        let mut past = chat();
        past[2] = ChatMessage::assistant("<think>\nhmm\n</think>\n\nHello!");
        assert!(t.render(&past, true, false).unwrap().contains("<assistant>Hello!<end>"));

        let doubled = vec![ChatMessage::user("a"), ChatMessage::user("b")];
        let err = t.render(&doubled, true, false).unwrap_err();
        assert!(err.contains("Roles must alternate"), "{err}");
    }

    #[test]
    fn generation_prompt_is_optional() {
        let t = ChatTemplate::new(None, String::new(), String::new());
        let with = t.render(&chat(), true, false).unwrap();
        let without = t.render(&chat(), false, false).unwrap();
        assert!(with.starts_with(&without));
        assert_eq!(&with[without.len()..], "<|im_start|>assistant\n");
    }

    #[test]
    fn generation_tags_are_ignored() {
        let src = "{%- for m in messages -%}\n{{- m.role + ':' -}}\n{%- generation -%}\n{{- m.content -}}\n{%- endgeneration -%}\n{{- ';' -}}\n{%- endfor -%}";
        let t = ChatTemplate::new(Some(src.into()), String::new(), String::new());
        let out = t.render(&[ChatMessage::user("x"), ChatMessage::assistant("y")], true, false).unwrap();
        assert_eq!(out, "user:x;assistant:y;");
    }

    #[test]
    fn strftime_now_never_fails() {
        assert!(!strftime_now("%d %b %Y".into()).is_empty());
        assert!(!strftime_now("%Q".into()).is_empty());
    }
}
