use candle_core::Tensor;

pub struct LogitsSampler {
    pub temperature: f64,
    pub top_p: f64,
    pub min_p: f32,
    pub repetition_penalty: f32,
    pub repeat_last_n: usize,
}

impl LogitsSampler {
    pub fn new(
        temperature: f64,
        top_p: f64,
        min_p: f32,
        repetition_penalty: f32,
        repeat_last_n: usize,
    ) -> Self {
        Self {
            temperature,
            top_p,
            min_p,
            repetition_penalty,
            repeat_last_n,
        }
    }

    /// Sample the next token from logits.
    /// `generated_tokens` should contain ONLY tokens generated so far (not prompt tokens).
    pub fn sample(&self, logits: &Tensor, generated_tokens: &[u32]) -> Result<u32, String> {
        let logits = logits.squeeze(0).map_err(|e| e.to_string())?;
        let logits = if logits.dims().len() > 1 {
            logits
                .get(logits.dim(0).map_err(|e| e.to_string())? - 1)
                .map_err(|e| e.to_string())?
        } else {
            logits
        };

        let mut logits_vec: Vec<f32> = logits.to_vec1().map_err(|e| e.to_string())?;

        // ── Step 1: Repetition penalty (windowed) ──
        // Only penalize the last `repeat_last_n` generated tokens — never prompt tokens.
        if self.repetition_penalty != 1.0 && !generated_tokens.is_empty() {
            let start = generated_tokens.len().saturating_sub(self.repeat_last_n);
            let window = &generated_tokens[start..];

            // Use a set to avoid double-penalizing the same token id
            let mut seen = std::collections::HashSet::new();
            for &token_id in window {
                if !seen.insert(token_id) {
                    continue;
                }
                let idx = token_id as usize;
                if idx < logits_vec.len() {
                    if logits_vec[idx] > 0.0 {
                        logits_vec[idx] /= self.repetition_penalty;
                    } else {
                        logits_vec[idx] *= self.repetition_penalty;
                    }
                }
            }
        }

        // ── Step 2: Greedy decoding if temperature is zero ──
        if self.temperature <= 0.0 {
            return Ok(logits_vec
                .iter()
                .enumerate()
                .max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal))
                .map(|(i, _)| i as u32)
                .unwrap_or(0));
        }

        // ── Step 3: Temperature scaling ──
        let temp = self.temperature as f32;
        for l in logits_vec.iter_mut() {
            *l /= temp;
        }

        // ── Step 4: Softmax → probabilities ──
        let max_logit = logits_vec.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
        let mut probs: Vec<f32> = logits_vec.iter().map(|&l| (l - max_logit).exp()).collect();
        let sum: f32 = probs.iter().sum();
        if sum > 0.0 {
            for p in probs.iter_mut() {
                *p /= sum;
            }
        }

        // ── Step 5: Min-p filtering ──
        // Discard tokens whose probability is below min_p × max_probability.
        // This dynamically adapts: when the model is confident, it cuts aggressively;
        // when uncertain, it allows more diversity.
        if self.min_p > 0.0 {
            let max_prob = probs.iter().cloned().fold(0.0f32, f32::max);
            let threshold = self.min_p * max_prob;
            for p in probs.iter_mut() {
                if *p < threshold {
                    *p = 0.0;
                }
            }
            // Re-normalize
            let sum: f32 = probs.iter().sum();
            if sum > 0.0 {
                for p in probs.iter_mut() {
                    *p /= sum;
                }
            }
        }

        // ── Step 6: Top-p (nucleus) sampling ──
        if self.top_p < 1.0 {
            let mut indexed: Vec<(usize, f32)> = probs.iter().copied().enumerate().collect();
            indexed.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

            let mut cumulative = 0.0f32;
            let top_p = self.top_p as f32;
            let mut mask = vec![false; probs.len()];

            for (idx, p) in &indexed {
                mask[*idx] = true;
                cumulative += p;
                if cumulative >= top_p {
                    break;
                }
            }

            for (i, p) in probs.iter_mut().enumerate() {
                if !mask[i] {
                    *p = 0.0;
                }
            }

            // Re-normalize
            let sum: f32 = probs.iter().sum();
            if sum > 0.0 {
                for p in probs.iter_mut() {
                    *p /= sum;
                }
            }
        }

        // ── Step 7: Random sample ──
        let r: f32 = rand::random();
        let mut cumulative = 0.0f32;
        for (i, &p) in probs.iter().enumerate() {
            cumulative += p;
            if cumulative >= r {
                return Ok(i as u32);
            }
        }

        Ok(probs.len().saturating_sub(1) as u32)
    }
}
