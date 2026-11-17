//! CPU-only inference avoids runtime DLL downloads and GPU-specific package paths.
use candle_core::{DType, Device, Tensor};
use candle_nn::VarBuilder;
use candle_transformers::models::bert::{BertModel, Config};
use std::path::Path;
use tokenizers::Tokenizer;

pub(super) const REVISION: &str = "614241f622f53c4eeff9890bdc4f31cfecc418b3";
pub(super) const IDENTITY: &str = "e5-small-614241f-mean-l2-chunks-v1";
pub(super) const FILES: [(&str, u64, &str); 3] = [
    (
        "config.json",
        655,
        "69137736cab8b8903a07fe8afaafdda25aac55415a12a55d1bffa9f581abf959",
    ),
    (
        "tokenizer.json",
        17082730,
        "0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39",
    ),
    (
        "model.safetensors",
        470641600,
        "1a55775f53449dac10a2bcbc312469fac40b96d53198c407081a831f81c98477",
    ),
];

pub(super) struct LocalEmbedder {
    model: BertModel,
    tokenizer: Tokenizer,
}

impl LocalEmbedder {
    pub fn load(root: &Path) -> Result<Self, String> {
        super::model_install::verify(root)?;
        let config: Config = serde_json::from_slice(
            &std::fs::read(root.join("config.json")).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
        if config.hidden_size != 384 || config.max_position_embeddings != 512 {
            return Err("Unsupported embedding configuration".into());
        }
        let tokenizer =
            Tokenizer::from_file(root.join("tokenizer.json")).map_err(|e| e.to_string())?;
        let weights = candle_core::safetensors::load(root.join("model.safetensors"), &Device::Cpu)
            .map_err(|e| e.to_string())?;
        let model = BertModel::load(
            VarBuilder::from_tensors(weights, DType::F32, &Device::Cpu),
            &config,
        )
        .map_err(|e| e.to_string())?;
        Ok(Self { model, tokenizer })
    }

    pub fn embed(&self, text: &str, query: bool) -> Result<Vec<f32>, String> {
        let text = format!("{}: {text}", if query { "query" } else { "passage" });
        let tokens = self
            .tokenizer
            .encode(text, true)
            .map_err(|e| e.to_string())?;
        let ids = tokens.get_ids();
        if ids.is_empty() || ids.len() > 512 {
            return Err("Embedding input exceeds 512 tokens".into());
        }
        let ids = Tensor::new(ids, &Device::Cpu)
            .and_then(|t| t.unsqueeze(0))
            .map_err(|e| e.to_string())?;
        let output = self
            .model
            .forward(&ids, &ids.zeros_like().map_err(|e| e.to_string())?, None)
            .map_err(|e| e.to_string())?;
        let mean = output
            .mean(1)
            .and_then(|t| t.squeeze(0))
            .and_then(|t| t.to_vec1::<f32>())
            .map_err(|e| e.to_string())?;
        normalize(mean)
    }

    /// Preserve source coordinates. Oversized single lines are omitted from the
    /// optional index, never truncated or credited as review coverage.
    pub fn chunks(&self, source: &str) -> Vec<(usize, usize, String)> {
        let mut chunks = Vec::new();
        let mut pending = String::new();
        let mut first = 1;
        for (index, line) in source.lines().enumerate() {
            if chunks.len() >= 8 {
                break;
            }
            let candidate = format!("{pending}{line}\n");
            let fits = self
                .tokenizer
                .encode(format!("passage: {candidate}"), true)
                .is_ok_and(|t| t.len() <= 384);
            if !fits || index + 1 - first >= 32 {
                if !pending.trim().is_empty() {
                    chunks.push((first, index, pending.clone()));
                }
                first = index + 1;
                pending.clear();
            }
            if line.len() > 4096
                || self
                    .tokenizer
                    .encode(format!("passage: {line}"), true)
                    .map_or(true, |t| t.len() > 384)
            {
                first = index + 2;
                continue;
            }
            pending.push_str(line);
            pending.push('\n');
        }
        if chunks.len() < 8 && !pending.trim().is_empty() {
            chunks.push((first, first + pending.lines().count() - 1, pending));
        }
        chunks
    }
}

pub(super) fn normalize(mut vector: Vec<f32>) -> Result<Vec<f32>, String> {
    let norm = vector.iter().map(|v| v * v).sum::<f32>().sqrt();
    if !norm.is_finite() || norm <= f32::EPSILON {
        return Err("Invalid embedding norm".into());
    }
    for value in &mut vector {
        *value /= norm;
    }
    Ok(vector)
}
