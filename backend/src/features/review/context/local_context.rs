use super::ReviewContext;
use crate::features::review::{local_context::LocalContextRuntime, security};
use serde_json::{json, Value};

impl ReviewContext {
    pub(crate) fn set_context_references(&mut self, allowed: bool) {
        self.allow_context_references = allowed;
    }
    pub(crate) fn local_context_metrics(&self) -> Option<Value> {
        self.local_cache.as_ref().map(|c| c.metrics())
    }
    pub(crate) fn enable_local_context(&mut self, runtime: &LocalContextRuntime) {
        let policy = serde_json::to_string(&self.guards.get_policy()).unwrap_or_default();
        self.local_cache = runtime.session(&self.snapshot, &policy);
    }
    pub(crate) fn related_context_available(&self) -> bool {
        self.local_cache
            .as_ref()
            .is_some_and(|c| c.semantic_ready())
    }
    pub(super) fn cached_blob(&self, path: &str, side: &str) -> Result<String, String> {
        security::safe_path(path, &self.guards)?;
        let gate = self.local_cache.as_ref().map(|cache| cache.read_gate());
        let _read = gate.as_ref().and_then(|gate| gate.lock().ok());
        let key = self.local_cache.as_ref().map(|c| {
            c.key(
                "blob",
                &json!([
                    self.snapshot.merge_base_sha,
                    self.snapshot.head_sha,
                    path,
                    side
                ]),
            )
        });
        if let (Some(cache), Some(key)) = (&self.local_cache, &key) {
            if let Some(text) = cache.get(key).and_then(|v| v.as_str().map(str::to_owned)) {
                cache.observe(path, side, &text);
                return Ok(text);
            }
        }
        // Evidence validation continues to call the original uncached blob().
        let text = self.blob(path, side)?;
        if let (Some(cache), Some(key)) = (&self.local_cache, &key) {
            cache.put(key, &json!(text));
            cache.observe(path, side, &text);
        }
        Ok(text)
    }
    pub(super) fn related_context(&mut self, query: &str) -> Result<Value, String> {
        self.guards
            .evaluate_review_read("search_related_context", None, 6)
            .map_err(|_| "Related context search blocked by policy")?;
        let Some(cache) = self.local_cache.clone() else {
            return Ok(
                json!({"matches":[],"indexComplete":false,"fallback":"Use search_code or read_file_range"}),
            );
        };
        let hits = match cache.search(query) {
            Ok(hits) => hits,
            Err(_) => {
                return Ok(
                    json!({"matches":[],"indexComplete":false,"fallback":"Local index is unavailable or busy; use search_code or read_file_range"}),
                )
            }
        };
        let mut matches = Vec::new();
        for hit in hits {
            // Index coordinates are hints, never authority. Re-read immutable
            // source through current guards; keep evidence checking independent.
            if security::safe_path(&hit.file_path, &self.guards).is_err() {
                continue;
            }
            if !matches!(hit.side.as_str(), "base" | "head")
                || hit.start_line == 0
                || hit.end_line < hit.start_line
                || hit.end_line - hit.start_line >= 200
            {
                continue;
            }
            if self
                .guards
                .evaluate_read_file(&hit.file_path, hit.start_line, hit.end_line)
                .is_err()
            {
                continue;
            }
            let Ok(source) = self.blob(&hit.file_path, &hit.side) else {
                continue;
            };
            if source.contains("[REDACTED") {
                self.limited = true;
            }
            let content = source
                .lines()
                .enumerate()
                .skip(hit.start_line - 1)
                .take(hit.end_line - hit.start_line + 1)
                .map(|(i, l)| format!("{}: {l}", i + 1))
                .collect::<Vec<_>>()
                .join("\n");
            if content.is_empty() {
                continue;
            }
            matches.push(json!({"filePath":hit.file_path,"side":hit.side,"startLine":hit.start_line,"endLine":hit.end_line,"content":content,"distance":hit.distance}));
            if json!(&matches).to_string().len() > 8 * 1024 {
                matches.pop();
                break;
            }
        }
        Ok(
            json!({"matches":matches,"indexComplete":false,"authority":"untrusted_repository_data","instruction":"Optional related context only. Empty matches do not prove absence. Follow the original diff cursor for complete review coverage."}),
        )
    }

    pub(super) fn remember_delivery(&mut self, value: &Value) {
        if value["alreadyDelivered"] != true {
            if let Some(id) = value["contextReference"].as_str() {
                if self.delivered_context.len() < 256 {
                    self.delivered_context.insert(id.to_owned());
                }
            }
        }
    }

    pub(super) fn deduplicate_delivery(&self, mut value: Value, name: &str, args: &Value) -> Value {
        if self.local_cache.is_none()
            || !self.allow_context_references
            || value.to_string().len() < 1024
        {
            return value;
        }
        use sha2::{Digest, Sha256};
        let identity = json!([
            self.snapshot.head_sha,
            self.snapshot.merge_base_sha,
            name,
            args,
            &value
        ])
        .to_string();
        let key = format!("ctx-{:x}", Sha256::digest(identity.as_bytes()));
        if self.delivered_context.contains(&key) {
            return json!({"alreadyDelivered":true,"contextReference":key,"instruction":"Identical source is present in the earlier tool result with this contextReference. Reuse that source; this reference is not new evidence or coverage."});
        }
        if self.delivered_context.len() < 256 {
            value["contextReference"] = json!(key);
        }
        value
    }
}
