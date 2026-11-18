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

#[tauri::command]
fn random_excerpt(state: State<'_, Excerpts>) -> Option<Excerpt> {
    let items = &state.items;
    if items.is_empty() {
        return None;
    }
    let mut last = state.last.lock().ok()?;
    let len = items.len();
    let idx = match *last {
        Some(prev) if len > 1 => (prev + 1 + (random_u64() % (len as u64 - 1)) as usize) % len,
        _ => (random_u64() % len as u64) as usize,
    };
    *last = Some(idx);
    Some(items[idx].clone())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let data: Vec<Excerpt> = serde_json::from_str(include_str!("../data/老子.json")).expect("sample.json 格式错误");

    tauri::Builder::default()
        .manage(Excerpts { items: data, last: Mutex::new(None) })
        .invoke_handler(tauri::generate_handler![random_excerpt])
        .run(tauri::generate_context!())
    .expect("error while running tauri application");
}