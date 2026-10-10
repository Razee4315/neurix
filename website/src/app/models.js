// The app's model catalogue (src-tauri/src/models/catalog.rs), smallest download first.
// `mb` is only used to size each model's stone; every label is the app's own.
export const models = [
  { name: 'Qwen 2.5 0.5B', maker: 'Alibaba', params: '0.5 billion', size: '380 MB', mb: 380, best: ['Ultra-fast', 'Basic tasks', 'Any device'] },
  { name: 'Llama 3.2 1B', maker: 'Meta', params: '1 billion', size: '700 MB', mb: 700, best: ['Quick chat', 'Simple Q&A', 'Low-end devices'] },
  { name: 'Qwen 2.5 1.5B', maker: 'Alibaba', params: '1.5 billion', size: '940 MB', mb: 940, best: ['Multilingual', 'Reasoning', 'Good balance'] },
  { name: 'SmolLM2 1.7B', maker: 'HuggingFace', params: '1.7 billion', size: '1.0 GB', mb: 1000, best: ['General chat', 'Summarization', 'Fast responses'] },
  { name: 'Gemma 2 2B', maker: 'Google', params: '2 billion', size: '1.5 GB', mb: 1500, best: ['On-device AI', 'General tasks', 'Balanced quality'] },
  { name: 'Qwen 2.5 3B', maker: 'Alibaba', params: '3 billion', size: '1.8 GB', mb: 1800, best: ['Complex tasks', 'Multilingual', 'High quality'] },
  { name: 'Llama 3.2 3B', maker: 'Meta', params: '3 billion', size: '2.0 GB', mb: 2000, best: ['Chat & reasoning', 'Creative writing', 'Best overall'] },
  { name: 'Phi-3.5 Mini', maker: 'Microsoft', params: '3.8 billion', size: '2.2 GB', mb: 2200, best: ['Code generation', 'Debugging', 'Technical Q&A'] },
]

// The six built-in characters (src-tauri/src/characters.rs).
export const characters = [
  { id: 'default', name: 'Default', note: 'Helpful and balanced' },
  { id: 'friendly', name: 'Friendly', note: 'Warm and casual' },
  { id: 'professional', name: 'Professional', note: 'Formal and precise' },
  { id: 'concise', name: 'Concise', note: 'Short and direct' },
  { id: 'tutor', name: 'Tutor', note: 'Explains step by step' },
  { id: 'creative', name: 'Creative', note: 'Playful and imaginative' },
]
