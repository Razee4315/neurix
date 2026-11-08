//! Models the user added from a Hugging Face link. They are kept in a small
//! JSON file next to the downloaded models and join the built-in catalog
//! everywhere a model is looked up by id.

use std::path::Path;
use std::sync::Mutex;

use log::warn;

use super::catalog::{self, ModelInfo};
use super::hub;

const FILE_NAME: &str = "added-models.json";

/// Serialises writes, so two adds at once cannot lose one of them.
static WRITE_LOCK: Mutex<()> = Mutex::new(());

/// Whether an entry read back from disk is safe to use. Its id becomes a
/// directory name and its repository and file go into a download URL, so a
/// hand-edited or damaged file must not be able to point anywhere else.
fn is_sound(model: &ModelInfo) -> bool {
    model.id.starts_with("hf-")
        && model.id.len() <= 80
        && model.id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.')
        && model.tag == "Added"
        && hub::valid_repo(&model.hf_repo)
        && hub::valid_filename(&model.hf_filename)
        && model.sha256.as_ref().is_some_and(|h| h.len() == 64)
}

/// The models the user has added, in the order they were added.
pub fn load(models_dir: &Path) -> Vec<ModelInfo> {
    let path = models_dir.join(FILE_NAME);
    let Ok(text) = std::fs::read_to_string(&path) else { return Vec::new() };
    match serde_json::from_str::<Vec<ModelInfo>>(&text) {
        Ok(models) => models.into_iter().filter(is_sound).collect(),
        Err(e) => {
            warn!("Ignoring unreadable {}: {}", FILE_NAME, e);
            Vec::new()
        }
    }
}

fn save(models_dir: &Path, models: &[ModelInfo]) -> Result<(), String> {
    std::fs::create_dir_all(models_dir).map_err(|e| e.to_string())?;
    let text = serde_json::to_string_pretty(models).map_err(|e| e.to_string())?;
    let tmp = models_dir.join(format!("{FILE_NAME}.tmp"));
    std::fs::write(&tmp, text).map_err(|e| format!("Could not save the added model: {e}"))?;
    std::fs::rename(&tmp, models_dir.join(FILE_NAME))
        .map_err(|e| format!("Could not save the added model: {e}"))
}

/// Add a model, or replace the entry with the same id.
pub fn upsert(models_dir: &Path, model: ModelInfo) -> Result<(), String> {
    if !is_sound(&model) {
        return Err("That model's details are not valid.".to_string());
    }
    let _guard = WRITE_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let mut models = load(models_dir);
    models.retain(|m| m.id != model.id);
    models.push(model);
    save(models_dir, &models)
}

/// Forget an added model. Ids that are not added models are ignored.
pub fn remove(models_dir: &Path, id: &str) -> Result<(), String> {
    let _guard = WRITE_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let mut models = load(models_dir);
    let before = models.len();
    models.retain(|m| m.id != id);
    if models.len() == before {
        return Ok(());
    }
    save(models_dir, &models)
}

/// The built-in catalog followed by the models the user added.
pub fn all_models(models_dir: &Path) -> Vec<ModelInfo> {
    let mut models = catalog::get_catalog();
    for added in load(models_dir) {
        if !models.iter().any(|m| m.id == added.id) {
            models.push(added);
        }
    }
    models
}

pub fn find(models_dir: &Path, id: &str) -> Option<ModelInfo> {
    all_models(models_dir).into_iter().find(|m| m.id == id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::catalog::{Reasoning, SamplingDefaults};

    fn sample(id: &str) -> ModelInfo {
        ModelInfo {
            id: id.into(),
            name: "x".into(),
            description: String::new(),
            size_bytes: 1_000_000_000,
            size_label: "1.0 GB".into(),
            tag: "Added".into(),
            hf_repo: "owner/repo-GGUF".into(),
            hf_filename: "model-Q4_K_M.gguf".into(),
            sha256: Some("a".repeat(64)),
            company: "owner".into(),
            parameters: "1B".into(),
            quantization: "Q4_K_M (4-bit)".into(),
            best_for: vec![],
            context_length: 8192,
            min_ram_gb: 4,
            quality: 3,
            speed: 3,
            reasoning: Reasoning::None,
            released: String::new(),
            legacy: false,
            sampling: SamplingDefaults { top_k: 40, min_p: 0.05, repeat_penalty: 1.0 },
        }
    }

    #[test]
    fn rejects_entries_that_could_escape_the_models_folder() {
        assert!(is_sound(&sample("hf-owner-repo-1234abcd")));
        assert!(!is_sound(&sample("../evil")));
        assert!(!is_sound(&sample("qwen-3.5-2b")));
        let mut bad_repo = sample("hf-a");
        bad_repo.hf_repo = "evil.com/../x".into();
        assert!(!is_sound(&bad_repo));
        let mut bad_file = sample("hf-b");
        bad_file.hf_filename = "../../x.gguf".into();
        assert!(!is_sound(&bad_file));
        let mut unpinned = sample("hf-c");
        unpinned.sha256 = None;
        assert!(!is_sound(&unpinned));
    }

    #[test]
    fn adds_replaces_and_removes() {
        let dir = std::env::temp_dir().join(format!("neurix-added-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        upsert(&dir, sample("hf-one")).unwrap();
        upsert(&dir, sample("hf-two")).unwrap();
        upsert(&dir, sample("hf-one")).unwrap();
        let ids: Vec<_> = load(&dir).into_iter().map(|m| m.id).collect();
        assert_eq!(ids, ["hf-two", "hf-one"]);
        assert!(find(&dir, "hf-two").is_some());
        assert!(find(&dir, "qwen-3.5-2b").is_some(), "the built-in catalog is still there");
        remove(&dir, "hf-two").unwrap();
        assert!(find(&dir, "hf-two").is_none());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
