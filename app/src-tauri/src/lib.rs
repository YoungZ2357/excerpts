use std::collections::hash_map::RandomState;
use std::hash::BuildHasher;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use tauri::State;

/// 与 @excerpts/schema 中的 Excerpt 保持一致
#[derive(Serialize, Deserialize, Clone)]
struct Excerpt {
    id: String,
    text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    translation: Option<String>,
    lang: String,
    path: Vec<String>,
    source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    extras: Option<serde_json::Map<String, serde_json::Value>>,
}

struct Excerpts {
    items: Vec<Excerpt>,
    last: Mutex<Option<usize>>,
}

fn random_u64() -> u64 {
    RandomState::new().hash_one(std::time::SystemTime::now())
}

/// 根据上一次的下标和随机数 `r` 选出下一个下标。
/// `len > 1` 且存在上一次下标时，保证不与上一次重复，并在其余 `len - 1` 个下标中均匀选取。
/// 调用方需保证 `len > 0`。
fn next_index(prev: Option<usize>, len: usize, r: u64) -> usize {
    match prev {
        Some(prev) if len > 1 => (prev + 1 + (r % (len as u64 - 1)) as usize) % len,
        _ => (r % len as u64) as usize,
    }
}

#[tauri::command]
fn random_excerpt(state: State<'_, Excerpts>) -> Option<Excerpt> {
    let items = &state.items;
    if items.is_empty() {
        return None;
    }
    let mut last = state.last.lock().ok()?;
    let idx = next_index(*last, items.len(), random_u64());
    *last = Some(idx);
    Some(items[idx].clone())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let data: Vec<Excerpt> = serde_json::from_str(include_str!("../data/sample.json")).expect("sample.json 格式错误");

    tauri::Builder::default()
        .manage(Excerpts { items: data, last: Mutex::new(None) })
        .invoke_handler(tauri::generate_handler![random_excerpt])
        .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn next_index_never_repeats_prev_and_stays_in_bounds() {
        for len in 2..=7 {
            for prev in 0..len {
                for r in 0..50u64 {
                    let idx = next_index(Some(prev), len, r);
                    assert!(idx < len, "len={len} prev={prev} r={r} -> {idx}");
                    assert_ne!(idx, prev, "len={len} prev={prev} r={r}");
                }
            }
        }
    }

    #[test]
    fn next_index_covers_every_other_index_exactly_once() {
        for len in 2..=7 {
            for prev in 0..len {
                let picked: Vec<usize> =
                    (0..(len as u64 - 1)).map(|r| next_index(Some(prev), len, r)).collect();
                let unique: HashSet<usize> = picked.iter().copied().collect();
                assert_eq!(unique.len(), len - 1, "len={len} prev={prev} picked={picked:?}");
                assert!(!unique.contains(&prev));
            }
        }
    }

    #[test]
    fn next_index_single_item_always_zero() {
        for r in 0..20u64 {
            assert_eq!(next_index(None, 1, r), 0);
            assert_eq!(next_index(Some(0), 1, r), 0);
        }
    }

    #[test]
    fn next_index_without_prev_stays_in_bounds() {
        for len in 1..=7 {
            for r in [0, 1, u64::MAX, u64::MAX - 1, 12345] {
                assert!(next_index(None, len, r) < len);
            }
        }
    }

    #[test]
    fn next_index_handles_large_random_values() {
        let len = 5;
        for prev in 0..len {
            for r in [u64::MAX, u64::MAX - 1, u64::MAX / 2] {
                let idx = next_index(Some(prev), len, r);
                assert!(idx < len);
                assert_ne!(idx, prev);
            }
        }
    }

    /// 内置数据必须能被反序列化，否则 run() 启动时会 panic；同时防止与 @excerpts/schema 走样。
    #[test]
    fn sample_data_deserializes() {
        let data: Vec<Excerpt> = serde_json::from_str(include_str!("../data/sample.json"))
            .expect("sample.json 应符合 Excerpt 结构");
        assert!(!data.is_empty());
        let ids: HashSet<&str> = data.iter().map(|e| e.id.as_str()).collect();
        assert_eq!(ids.len(), data.len(), "id 不应重复");
    }

    #[test]
    fn excerpt_optional_fields_round_trip() {
        let json = r#"{"id":"a#0","text":"t","lang":"lzh","path":["a"],"source":"a"}"#;
        let e: Excerpt = serde_json::from_str(json).unwrap();
        assert!(e.translation.is_none() && e.extras.is_none());
        let back = serde_json::to_value(&e).unwrap();
        assert!(back.get("translation").is_none());
        assert!(back.get("extras").is_none());
    }

    #[test]
    fn excerpt_rejects_missing_required_field() {
        let json = r#"{"id":"a#0","lang":"lzh","path":["a"],"source":"a"}"#;
        assert!(serde_json::from_str::<Excerpt>(json).is_err());
    }
}
