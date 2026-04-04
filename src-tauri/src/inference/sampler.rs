use candle_core::Tensor;

pub struct LogitsSampler {
    pub temperature: f64,
    pub top_p: f64,
    pub repetition_penalty: f32,
}

impl LogitsSampler {
    pub fn new(temperature: f64, top_p: f64, repetition_penalty: f32) -> Self {
        Self {
            temperature,
            top_p,
            repetition_penalty,
        }
    }

    pub fn sample(&self, logits: &Tensor, past_tokens: &[u32]) -> Result<u32, String> {
        let logits = logits
            .squeeze(0)
            .map_err(|e| e.to_string())?;
        let logits = if logits.dims().len() > 1 {
            logits
                .get(logits.dim(0).map_err(|e| e.to_string())? - 1)
                .map_err(|e| e.to_string())?
        } else {
            logits
        };

        let mut logits_vec: Vec<f32> = logits.to_vec1().map_err(|e| e.to_string())?;

        // Repetition penalty
        if self.repetition_penalty != 1.0 {
            for &token_id in past_tokens {
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

        if self.temperature <= 0.0 {
            // Greedy
            return Ok(logits_vec
                .iter()
                .enumerate()
                .max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal))
                .map(|(i, _)| i as u32)
                .unwrap_or(0));
        }

        // Temperature scaling
        let temp = self.temperature as f32;
        for l in logits_vec.iter_mut() {
            *l /= temp;
        }

        // Softmax
        let max_logit = logits_vec.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
        let mut probs: Vec<f32> = logits_vec.iter().map(|&l| (l - max_logit).exp()).collect();
        let sum: f32 = probs.iter().sum();
        for p in probs.iter_mut() {
            *p /= sum;
        }

        // Top-p (nucleus) sampling
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

            let sum: f32 = probs.iter().sum();
            if sum > 0.0 {
                for p in probs.iter_mut() {
                    *p /= sum;
                }
            }
        }

        // Random sample
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
