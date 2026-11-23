//! 用户卡片与设置的文件读写。
//!
//! 这里只负责“把文件读出来 / 写进去”，卡片内容的校验与回退全部由前端 resolve.ts 完成，
//! 避免 Rust 与 TS 各维护一套规则。

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::io;
use std::path::Path;

pub const MAX_CARD_FILE_BYTES: u64 = 256 * 1024;
pub const MAX_CARD_FILES: usize = 200;
pub const SETTINGS_SCHEMA_VERSION: u32 = 1;
pub const DEFAULT_CARD_ID: &str = "classic";

/// 一个卡片文件的读取结果：成功时带 `card`（原始 JSON），失败时带 `error`
#[derive(Serialize, Debug, PartialEq)]
pub struct UserCardFile {
    pub file: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub card: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl UserCardFile {
    fn ok(file: String, id: String, card: Value) -> Self {
        Self { file, id: Some(id), card: Some(card), error: None }
    }
    fn err(file: String, error: impl Into<String>) -> Self {
        Self { file, id: None, card: None, error: Some(error.into()) }
    }
}

/// 卡片 id 取自文件名：1~64 个小写字母、数字、`-`、`_`
pub fn is_valid_card_id(id: &str) -> bool {
    (1..=64).contains(&id.len())
        && id.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-' || b == b'_')
}

/// 扫描卡片目录下的 `*.json`（按文件名排序）；目录不存在时返回空列表
pub fn scan_cards_dir(dir: &Path) -> Vec<UserCardFile> {
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Vec::new(),
        Err(e) => return vec![UserCardFile::err("*".into(), format!("无法读取卡片目录：{e}"))],
    };

    let mut paths: Vec<_> = entries
        .filter_map(Result::ok)
        .map(|e| e.path())
        .filter(|p| p.is_file())
        .filter(|p| p.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("json")))
        .collect();
    paths.sort();

    let mut out = Vec::new();
    if paths.len() > MAX_CARD_FILES {
        out.push(UserCardFile::err(
            "*".into(),
            format!("卡片文件共 {} 个，超过上限 {MAX_CARD_FILES}，多出的已忽略", paths.len()),
        ));
        paths.truncate(MAX_CARD_FILES);
    }

    for path in paths {
        let file = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        let stem = path.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
        out.push(read_card_file(&path, file, stem));
    }
    out
}

fn read_card_file(path: &Path, file: String, id: String) -> UserCardFile {
    if !is_valid_card_id(&id) {
        return UserCardFile::err(file, "文件名只能包含小写字母、数字、- 和 _（不超过 64 个字符）");
    }
    match fs::metadata(path) {
        Ok(m) if m.len() > MAX_CARD_FILE_BYTES => {
            return UserCardFile::err(file, format!("文件超过 {} KB", MAX_CARD_FILE_BYTES / 1024));
        }
        Err(e) => return UserCardFile::err(file, format!("无法读取：{e}")),
        Ok(_) => {}
    }
    let text = match fs::read_to_string(path) {
        Ok(t) => t,
        Err(e) => return UserCardFile::err(file, format!("无法读取（需为 UTF-8 编码）：{e}")),
    };
    // Windows 记事本保存的 UTF-8 文件可能带 BOM
    match serde_json::from_str::<Value>(text.trim_start_matches('\u{feff}')) {
        Ok(card) => UserCardFile::ok(file, id, card),
        Err(e) => UserCardFile::err(file, format!("JSON 格式错误：{e}")),
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    #[serde(default = "default_schema_version")]
    pub schema_version: u32,
    #[serde(default = "default_card_id")]
    pub current_card: String,
}

fn default_schema_version() -> u32 {
    SETTINGS_SCHEMA_VERSION
}

fn default_card_id() -> String {
    DEFAULT_CARD_ID.into()
}

impl Default for Settings {
    fn default() -> Self {
        Self { schema_version: SETTINGS_SCHEMA_VERSION, current_card: default_card_id() }
    }
}

/// 读取设置；文件不存在或已损坏时返回默认值
pub fn load_settings(path: &Path) -> Settings {
    let Ok(text) = fs::read_to_string(path) else { return Settings::default() };
    serde_json::from_str(text.trim_start_matches('\u{feff}')).unwrap_or_else(|e| {
        eprintln!("[settings] {} 解析失败，使用默认设置：{e}", path.display());
        Settings::default()
    })
}

/// 先写临时文件再重命名，避免写到一半时崩溃导致设置文件损坏
pub fn save_settings(path: &Path, settings: &Settings) -> io::Result<()> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    let json = serde_json::to_string_pretty(settings).map_err(io::Error::other)?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, json)?;
    fs::rename(&tmp, path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicUsize, Ordering};

    /// 测试用临时目录，离开作用域时自动删除
    struct TempDir(PathBuf);

    impl TempDir {
        fn new() -> Self {
            static COUNTER: AtomicUsize = AtomicUsize::new(0);
            let name = format!("excerpts-test-{}-{}", std::process::id(), COUNTER.fetch_add(1, Ordering::SeqCst));
            let dir = std::env::temp_dir().join(name);
            fs::create_dir_all(&dir).unwrap();
            Self(dir)
        }
        fn write(&self, name: &str, content: impl AsRef<[u8]>) {
            fs::write(self.0.join(name), content).unwrap();
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn card_id_rules() {
        for ok in ["a", "kaiti", "my-card_2", &"x".repeat(64)] {
            assert!(is_valid_card_id(ok), "{ok}");
        }
        for bad in ["", "Kaiti", "楷体", "a b", "a.b", &"x".repeat(65)] {
            assert!(!is_valid_card_id(bad), "{bad}");
        }
    }

    #[test]
    fn missing_dir_is_empty() {
        let tmp = TempDir::new();
        assert!(scan_cards_dir(&tmp.0.join("nope")).is_empty());
    }

    #[test]
    fn scans_json_files_sorted_and_reports_errors() {
        let tmp = TempDir::new();
        tmp.write("b.json", r#"{"id":"b"}"#);
        tmp.write("a.json", "\u{feff}{\"id\":\"a\"}");
        tmp.write("broken.json", "{ not json");
        tmp.write("Bad Name.json", "{}");
        tmp.write("notes.txt", "ignored");
        fs::create_dir(tmp.0.join("dir.json")).unwrap();

        let files = scan_cards_dir(&tmp.0);
        let names: Vec<_> = files.iter().map(|f| f.file.as_str()).collect();
        assert_eq!(names, ["Bad Name.json", "a.json", "b.json", "broken.json"]);

        assert!(files[0].error.as_deref().unwrap().contains("文件名"));
        assert_eq!(files[1], UserCardFile::ok("a.json".into(), "a".into(), serde_json::json!({"id":"a"})));
        assert_eq!(files[2].id.as_deref(), Some("b"));
        assert!(files[3].error.as_deref().unwrap().contains("JSON"));
    }

    #[test]
    fn rejects_oversized_file() {
        let tmp = TempDir::new();
        tmp.write("big.json", vec![b' '; MAX_CARD_FILE_BYTES as usize + 1]);
        let files = scan_cards_dir(&tmp.0);
        assert!(files[0].error.as_deref().unwrap().contains("KB"));
    }

    #[test]
    fn limits_file_count() {
        let tmp = TempDir::new();
        for i in 0..MAX_CARD_FILES + 3 {
            tmp.write(&format!("c{i:03}.json"), "{}");
        }
        let files = scan_cards_dir(&tmp.0);
        assert_eq!(files.len(), MAX_CARD_FILES + 1);
        assert_eq!(files[0].file, "*");
    }

    #[test]
    fn serializes_without_empty_fields() {
        let v = serde_json::to_value(UserCardFile::err("x.json".into(), "boom")).unwrap();
        assert_eq!(v, serde_json::json!({"file":"x.json","error":"boom"}));
    }

    #[test]
    fn settings_round_trip() {
        let tmp = TempDir::new();
        let path = tmp.0.join("sub").join("settings.json");
        let s = Settings { schema_version: 1, current_card: "kaiti".into() };
        save_settings(&path, &s).unwrap();
        assert_eq!(load_settings(&path), s);
        assert!(!path.with_extension("json.tmp").exists());
        let raw: Value = serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(raw["currentCard"], "kaiti");
    }

    #[test]
    fn settings_fallback_to_default() {
        let tmp = TempDir::new();
        assert_eq!(load_settings(&tmp.0.join("missing.json")), Settings::default());
        tmp.write("bad.json", "{ broken");
        assert_eq!(load_settings(&tmp.0.join("bad.json")), Settings::default());
        tmp.write("partial.json", "{}");
        assert_eq!(load_settings(&tmp.0.join("partial.json")), Settings::default());
    }
}
