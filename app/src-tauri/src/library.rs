//! 数据集库：导入的摘抄保存在 `<本地数据目录>/library.db`（SQLite）中。
//!
//! - 每次导入生成一个数据集，导入的内容会复制进数据库，原文件之后可以移动或删除；
//! - 数据集可以单独启用 / 停用，抽句时从所有启用的数据集中按条数均匀抽取；
//! - 启用状态保存在数据库中，重启后保留，新导入的数据集默认启用。

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::Path;

/// 数据库结构版本，记录在 `PRAGMA user_version` 中
pub const DB_SCHEMA_VERSION: i32 = 1;
/// 单个导入文件的大小上限
pub const MAX_DATASET_FILE_BYTES: u64 = 512 * 1024 * 1024;
/// 首次创建数据库时自动导入的示例数据集
const SAMPLE_NAME: &str = "示例";
const SAMPLE_JSON: &str = include_str!("../data/sample.json");

/// 与 @excerpts/schema 中的 Excerpt 保持一致
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Excerpt {
    pub id: String,
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub translation: Option<String>,
    pub lang: String,
    pub path: Vec<String>,
    pub source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extras: Option<serde_json::Map<String, serde_json::Value>>,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DatasetInfo {
    pub id: i64,
    pub name: String,
    pub count: i64,
    /// Unix 时间戳（秒）
    pub imported_at: i64,
    pub active: bool,
}

/// 根据上一次的下标和随机数 `r` 选出下一个下标。
/// `len > 1` 且存在上一次下标时，保证不与上一次重复，并在其余 `len - 1` 个下标中均匀选取。
/// 调用方需保证 `len > 0`。
pub fn next_index(prev: Option<usize>, len: usize, r: u64) -> usize {
    match prev {
        Some(prev) if prev < len && len > 1 => (prev + 1 + (r % (len as u64 - 1)) as usize) % len,
        _ => (r % len as u64) as usize,
    }
}

/// 文件内容的 FNV-1a 64 位哈希，用于识别重复导入（不用于安全目的）
pub fn content_hash(bytes: &[u8]) -> String {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for &b in bytes {
        h ^= b as u64;
        h = h.wrapping_mul(0x0000_0100_0000_01b3);
    }
    format!("{h:016x}")
}

/// 解析并校验导入文件：UTF-8（可带 BOM）的 `Excerpt[]`，非空，id 非空且不重复，text 非空
pub fn parse_dataset(bytes: &[u8]) -> Result<Vec<Excerpt>, String> {
    let text = std::str::from_utf8(bytes).map_err(|_| "文件不是 UTF-8 编码".to_string())?;
    let items: Vec<Excerpt> = serde_json::from_str(text.trim_start_matches('\u{feff}'))
        .map_err(|e| format!("JSON 格式错误（需为摘抄数组）：{e}"))?;
    if items.is_empty() {
        return Err("数据集为空".into());
    }
    let mut ids = HashSet::with_capacity(items.len());
    for (i, e) in items.iter().enumerate() {
        if e.id.is_empty() {
            return Err(format!("第 {} 条的 id 为空", i + 1));
        }
        if e.text.trim().is_empty() {
            return Err(format!("第 {} 条（id：{}）的 text 为空", i + 1, e.id));
        }
        if !ids.insert(e.id.as_str()) {
            return Err(format!("id 重复：{}", e.id));
        }
    }
    Ok(items)
}

fn now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// 在启用的数据集 `(id, 条数)` 列表中，把全局下标换算为 `(数据集 id, 序号)`
fn locate(actives: &[(i64, i64)], mut g: i64) -> Option<(i64, i64)> {
    for &(id, count) in actives {
        if g < count {
            return Some((id, g));
        }
        g -= count;
    }
    None
}

/// `locate` 的逆运算；数据集已不在启用列表中时返回 None
fn global_of(actives: &[(i64, i64)], (dataset, seq): (i64, i64)) -> Option<i64> {
    let mut offset = 0;
    for &(id, count) in actives {
        if id == dataset {
            return (seq < count).then_some(offset + seq);
        }
        offset += count;
    }
    None
}

pub struct Library {
    conn: Connection,
    /// 上一次抽到的 `(数据集 id, 序号)`，用于避免连续重复
    last: Option<(i64, i64)>,
}

impl Library {
    pub fn open(path: &Path) -> Result<Self, String> {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir).map_err(|e| format!("无法创建数据目录：{e}"))?;
        }
        let conn = Connection::open(path).map_err(|e| format!("无法打开数据库 {}：{e}", path.display()))?;
        Self::init(conn)
    }

    #[cfg(test)]
    pub fn open_in_memory() -> Result<Self, String> {
        Self::init(Connection::open_in_memory().map_err(|e| e.to_string())?)
    }

    fn init(conn: Connection) -> Result<Self, String> {
        let err = |e: rusqlite::Error| format!("初始化数据库失败：{e}");
        conn.pragma_update(None, "foreign_keys", true).map_err(err)?;
        let version: i32 = conn.pragma_query_value(None, "user_version", |r| r.get(0)).map_err(err)?;
        let mut lib = Self { conn, last: None };
        match version {
            0 => lib.create_schema().map_err(err)?,
            DB_SCHEMA_VERSION => {}
            v => {
                return Err(format!(
                    "数据库版本 {v} 高于本程序支持的版本 {DB_SCHEMA_VERSION}，请升级应用"
                ));
            }
        }
        Ok(lib)
    }

    /// 新建数据库：建表并导入示例数据集
    fn create_schema(&mut self) -> rusqlite::Result<()> {
        // auto_vacuum 必须在建表前设置，删除数据集后可回收磁盘空间
        self.conn.pragma_update(None, "auto_vacuum", "INCREMENTAL")?;
        let tx = self.conn.transaction()?;
        tx.execute_batch(
            "CREATE TABLE datasets (
                id          INTEGER PRIMARY KEY,
                name        TEXT    NOT NULL,
                hash        TEXT    NOT NULL UNIQUE,
                count       INTEGER NOT NULL,
                imported_at INTEGER NOT NULL,
                active      INTEGER NOT NULL DEFAULT 1
            );
            CREATE TABLE excerpts (
                dataset_id  INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
                seq         INTEGER NOT NULL,
                id          TEXT    NOT NULL,
                text        TEXT    NOT NULL,
                translation TEXT,
                lang        TEXT    NOT NULL,
                path        TEXT    NOT NULL,
                source      TEXT    NOT NULL,
                extras      TEXT,
                PRIMARY KEY (dataset_id, seq),
                UNIQUE (dataset_id, id)
            ) WITHOUT ROWID;",
        )?;
        let sample: Vec<Excerpt> = serde_json::from_str(SAMPLE_JSON).expect("sample.json 应符合 Excerpt 结构");
        insert_dataset_tx(&tx, SAMPLE_NAME, &content_hash(SAMPLE_JSON.as_bytes()), &sample)?;
        tx.pragma_update(None, "user_version", DB_SCHEMA_VERSION)?;
        tx.commit()
    }

    pub fn list(&self) -> Result<Vec<DatasetInfo>, String> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, name, count, imported_at, active FROM datasets ORDER BY id")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |r| {
                Ok(DatasetInfo {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    count: r.get(2)?,
                    imported_at: r.get(3)?,
                    active: r.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<_, _>>().map_err(|e| format!("读取数据集列表失败：{e}"))
    }

    pub fn name_of(&self, id: i64) -> Result<String, String> {
        self.conn
            .query_row("SELECT name FROM datasets WHERE id = ?1", [id], |r| r.get(0))
            .optional()
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "数据集不存在".into())
    }

    /// 已导入过相同内容时返回该数据集的名称
    pub fn find_by_hash(&self, hash: &str) -> Result<Option<String>, String> {
        self.conn
            .query_row("SELECT name FROM datasets WHERE hash = ?1", [hash], |r| r.get(0))
            .optional()
            .map_err(|e| e.to_string())
    }

    /// 写入一个已通过 `parse_dataset` 校验的数据集；名称重复时自动加序号
    pub fn insert_dataset(&mut self, name: &str, hash: &str, items: &[Excerpt]) -> Result<DatasetInfo, String> {
        if let Some(existing) = self.find_by_hash(hash)? {
            return Err(format!("该文件已导入为「{existing}」"));
        }
        let err = |e: rusqlite::Error| format!("写入数据集失败：{e}");
        let tx = self.conn.transaction().map_err(err)?;
        let name = unique_name(&tx, name).map_err(err)?;
        let id = insert_dataset_tx(&tx, &name, hash, items).map_err(err)?;
        tx.commit().map_err(err)?;
        Ok(DatasetInfo { id, name, count: items.len() as i64, imported_at: now_secs(), active: true })
    }

    pub fn set_active(&mut self, id: i64, active: bool) -> Result<(), String> {
        let n = self
            .conn
            .execute("UPDATE datasets SET active = ?1 WHERE id = ?2", params![active, id])
            .map_err(|e| e.to_string())?;
        if n == 0 { Err("数据集不存在".into()) } else { Ok(()) }
    }

    pub fn delete(&mut self, id: i64) -> Result<(), String> {
        let n = self
            .conn
            .execute("DELETE FROM datasets WHERE id = ?1", [id])
            .map_err(|e| format!("删除数据集失败：{e}"))?;
        if n == 0 {
            return Err("数据集不存在".into());
        }
        if self.last.is_some_and(|(d, _)| d == id) {
            self.last = None;
        }
        // 回收空间失败不影响删除结果
        if let Err(e) = self.conn.execute_batch("PRAGMA incremental_vacuum;") {
            eprintln!("[library] 回收空间失败：{e}");
        }
        Ok(())
    }

    /// 从所有启用的数据集中均匀抽一条（不与上一条重复）；没有可用数据时返回 None
    pub fn random(&mut self, r: u64) -> Result<Option<Excerpt>, String> {
        let actives = self.active_counts()?;
        let total: i64 = actives.iter().map(|&(_, c)| c).sum();
        if total == 0 {
            self.last = None;
            return Ok(None);
        }
        let prev = self.last.and_then(|l| global_of(&actives, l)).map(|g| g as usize);
        let g = next_index(prev, total as usize, r) as i64;
        let (dataset, seq) = locate(&actives, g).expect("全局下标应在范围内");
        let excerpt = self.get(dataset, seq)?;
        self.last = Some((dataset, seq));
        Ok(Some(excerpt))
    }

    fn active_counts(&self) -> Result<Vec<(i64, i64)>, String> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, count FROM datasets WHERE active = 1 AND count > 0 ORDER BY id")
            .map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?))).map_err(|e| e.to_string())?;
        rows.collect::<Result<_, _>>().map_err(|e| e.to_string())
    }

    fn get(&self, dataset: i64, seq: i64) -> Result<Excerpt, String> {
        let row = self
            .conn
            .query_row(
                "SELECT id, text, translation, lang, path, source, extras
                 FROM excerpts WHERE dataset_id = ?1 AND seq = ?2",
                [dataset, seq],
                |r| {
                    Ok((
                        r.get::<_, String>(0)?,
                        r.get::<_, String>(1)?,
                        r.get::<_, Option<String>>(2)?,
                        r.get::<_, String>(3)?,
                        r.get::<_, String>(4)?,
                        r.get::<_, String>(5)?,
                        r.get::<_, Option<String>>(6)?,
                    ))
                },
            )
            .map_err(|e| format!("读取摘抄失败：{e}"))?;
        let (id, text, translation, lang, path, source, extras) = row;
        let corrupt = |e: serde_json::Error| format!("摘抄 {id} 数据损坏：{e}");
        Ok(Excerpt {
            path: serde_json::from_str(&path).map_err(corrupt)?,
            extras: extras.map(|x| serde_json::from_str(&x)).transpose().map_err(corrupt)?,
            id,
            text,
            translation,
            lang,
            source,
        })
    }
}

fn unique_name(conn: &Connection, base: &str) -> rusqlite::Result<String> {
    let base = if base.trim().is_empty() { "未命名" } else { base.trim() };
    let exists = |name: &str| -> rusqlite::Result<bool> {
        conn.query_row("SELECT EXISTS(SELECT 1 FROM datasets WHERE name = ?1)", [name], |r| r.get(0))
    };
    if !exists(base)? {
        return Ok(base.to_string());
    }
    let mut n = 2;
    loop {
        let name = format!("{base} ({n})");
        if !exists(&name)? {
            return Ok(name);
        }
        n += 1;
    }
}

fn insert_dataset_tx(conn: &Connection, name: &str, hash: &str, items: &[Excerpt]) -> rusqlite::Result<i64> {
    conn.execute(
        "INSERT INTO datasets (name, hash, count, imported_at, active) VALUES (?1, ?2, ?3, ?4, 1)",
        params![name, hash, items.len() as i64, now_secs()],
    )?;
    let id = conn.last_insert_rowid();
    let mut stmt = conn.prepare(
        "INSERT INTO excerpts (dataset_id, seq, id, text, translation, lang, path, source, extras)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
    )?;
    for (seq, e) in items.iter().enumerate() {
        let path = serde_json::to_string(&e.path).expect("字符串数组总能序列化");
        let extras = e.extras.as_ref().map(|x| serde_json::to_string(x).expect("JSON 对象总能序列化"));
        stmt.execute(params![id, seq as i64, e.id, e.text, e.translation, e.lang, path, e.source, extras])?;
    }
    Ok(id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn ex(id: &str) -> Excerpt {
        Excerpt {
            id: id.into(),
            text: format!("text {id}"),
            translation: None,
            lang: "lzh".into(),
            path: vec!["书".into(), "篇".into()],
            source: "书".into(),
            extras: None,
        }
    }

    /// 把连续整数打散成分布均匀的伪随机数，模拟真实的随机源
    fn splitmix64(x: u64) -> u64 {
        let mut z = x.wrapping_add(0x9e37_79b9_7f4a_7c15);
        z = (z ^ (z >> 30)).wrapping_mul(0xbf58_476d_1ce4_e5b9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94d0_49bb_1331_11eb);
        z ^ (z >> 31)
    }

    fn json(items: &[Excerpt]) -> Vec<u8> {
        serde_json::to_vec(items).unwrap()
    }

    /// 新库（已含示例数据集）中再导入一个数据集
    fn import(lib: &mut Library, name: &str, items: &[Excerpt]) -> DatasetInfo {
        let bytes = json(items);
        let parsed = parse_dataset(&bytes).unwrap();
        lib.insert_dataset(name, &content_hash(&bytes), &parsed).unwrap()
    }

    /* ---------- next_index ---------- */

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
                let picked: HashSet<usize> = (0..(len as u64 - 1)).map(|r| next_index(Some(prev), len, r)).collect();
                assert_eq!(picked.len(), len - 1, "len={len} prev={prev}");
                assert!(!picked.contains(&prev));
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
    fn next_index_handles_large_random_values_and_stale_prev() {
        for len in 1..=7 {
            for r in [0, 1, u64::MAX, u64::MAX - 1, u64::MAX / 2, 12345] {
                assert!(next_index(None, len, r) < len);
                assert!(next_index(Some(len + 3), len, r) < len, "越界的 prev 应被忽略");
                for prev in 0..len {
                    let idx = next_index(Some(prev), len, r);
                    assert!(idx < len);
                    if len > 1 {
                        assert_ne!(idx, prev);
                    }
                }
            }
        }
    }

    /* ---------- 解析与校验 ---------- */

    #[test]
    fn sample_data_is_valid() {
        let items = parse_dataset(SAMPLE_JSON.as_bytes()).expect("sample.json 应通过导入校验");
        assert!(!items.is_empty());
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
    fn parse_accepts_bom() {
        let mut bytes = "\u{feff}".as_bytes().to_vec();
        bytes.extend(json(&[ex("a")]));
        assert_eq!(parse_dataset(&bytes).unwrap(), vec![ex("a")]);
    }

    #[test]
    fn parse_rejects_bad_input() {
        let cases: [(&[u8], &str); 6] = [
            (b"\xff\xfe", "UTF-8"),
            (b"{ not json", "JSON"),
            (br#"{"id":"a"}"#, "JSON"),
            (br#"[{"id":"a","lang":"lzh","path":[],"source":"s"}]"#, "JSON"),
            (b"[]", "为空"),
            (br#"[{"id":"","text":"t","lang":"l","path":[],"source":"s"}]"#, "id 为空"),
        ];
        for (input, expect) in cases {
            let err = parse_dataset(input).unwrap_err();
            assert!(err.contains(expect), "{input:?}: {err}");
        }
        let blank = Excerpt { text: "  ".into(), ..ex("a") };
        assert!(parse_dataset(&json(&[blank])).unwrap_err().contains("text 为空"));
        assert!(parse_dataset(&json(&[ex("a"), ex("a")])).unwrap_err().contains("id 重复"));
    }

    #[test]
    fn content_hash_is_stable_and_sensitive() {
        assert_eq!(content_hash(b""), "cbf29ce484222325");
        assert_eq!(content_hash(b"abc"), content_hash(b"abc"));
        assert_ne!(content_hash(b"abc"), content_hash(b"abd"));
    }

    /* ---------- 下标换算 ---------- */

    #[test]
    fn locate_and_global_of_are_inverse() {
        let actives = [(1, 3), (5, 1), (9, 2)];
        let all: Vec<_> = (0..6).map(|g| locate(&actives, g).unwrap()).collect();
        assert_eq!(all, [(1, 0), (1, 1), (1, 2), (5, 0), (9, 0), (9, 1)]);
        for (g, pos) in all.iter().enumerate() {
            assert_eq!(global_of(&actives, *pos), Some(g as i64));
        }
        assert_eq!(locate(&actives, 6), None);
        assert_eq!(global_of(&actives, (2, 0)), None);
        assert_eq!(global_of(&actives, (5, 1)), None);
    }

    /* ---------- 数据库 ---------- */

    #[test]
    fn new_library_contains_sample() {
        let mut lib = Library::open_in_memory().unwrap();
        let list = lib.list().unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].name, SAMPLE_NAME);
        assert!(list[0].active);
        let sample = parse_dataset(SAMPLE_JSON.as_bytes()).unwrap();
        assert_eq!(list[0].count, sample.len() as i64);
        assert!(sample.contains(&lib.random(0).unwrap().unwrap()));
    }

    #[test]
    fn import_round_trips_all_fields() {
        let mut lib = Library::open_in_memory().unwrap();
        let mut full = ex("full");
        full.translation = Some("译文".into());
        full.extras = Some(serde_json::json!({"note": 1, "tags": ["x"]}).as_object().unwrap().clone());
        let info = import(&mut lib, "book", &[full.clone()]);
        assert_eq!((info.name.as_str(), info.count, info.active), ("book", 1, true));
        assert_eq!(lib.get(info.id, 0).unwrap(), full);
    }

    #[test]
    fn duplicate_content_is_rejected_and_names_are_unique() {
        let mut lib = Library::open_in_memory().unwrap();
        let bytes = json(&[ex("a")]);
        let items = parse_dataset(&bytes).unwrap();
        lib.insert_dataset("book", &content_hash(&bytes), &items).unwrap();
        let err = lib.insert_dataset("other", &content_hash(&bytes), &items).unwrap_err();
        assert!(err.contains("「book」"), "{err}");
        assert_eq!(lib.find_by_hash(&content_hash(&bytes)).unwrap().as_deref(), Some("book"));

        assert_eq!(import(&mut lib, "book", &[ex("b")]).name, "book (2)");
        assert_eq!(import(&mut lib, "book", &[ex("c")]).name, "book (3)");
        assert_eq!(import(&mut lib, "  ", &[ex("d")]).name, "未命名");
    }

    #[test]
    fn same_ids_in_different_datasets_are_allowed() {
        let mut lib = Library::open_in_memory().unwrap();
        import(&mut lib, "a", &[ex("x")]);
        let mut other = ex("x");
        other.text = "different".into();
        import(&mut lib, "b", &[other]);
        assert_eq!(lib.list().unwrap().len(), 3);
    }

    #[test]
    fn random_only_uses_active_datasets_and_never_repeats() {
        let mut lib = Library::open_in_memory().unwrap();
        let sample_id = lib.list().unwrap()[0].id;
        lib.set_active(sample_id, false).unwrap();
        let a = import(&mut lib, "a", &[ex("a0"), ex("a1")]);
        let b = import(&mut lib, "b", &[ex("b0"), ex("b1"), ex("b2")]);

        let mut seen: HashMap<String, usize> = HashMap::new();
        let mut prev: Option<String> = None;
        for r in 0..500u64 {
            let e = lib.random(splitmix64(r)).unwrap().unwrap();
            assert_ne!(prev.as_ref(), Some(&e.id), "连续两次抽到同一条");
            *seen.entry(e.id.clone()).or_default() += 1;
            prev = Some(e.id);
        }
        let mut ids: Vec<_> = seen.keys().cloned().collect();
        ids.sort();
        assert_eq!(ids, ["a0", "a1", "b0", "b1", "b2"], "只应抽到启用的数据集，且每条都能抽到");

        lib.set_active(a.id, false).unwrap();
        for r in 0..50 {
            assert!(lib.random(r).unwrap().unwrap().id.starts_with('b'));
        }
        lib.set_active(b.id, false).unwrap();
        assert_eq!(lib.random(0).unwrap(), None);
    }

    #[test]
    fn single_item_can_repeat() {
        let mut lib = Library::open_in_memory().unwrap();
        let sample_id = lib.list().unwrap()[0].id;
        lib.delete(sample_id).unwrap();
        import(&mut lib, "one", &[ex("only")]);
        for r in 0..5 {
            assert_eq!(lib.random(r).unwrap().unwrap().id, "only");
        }
    }

    #[test]
    fn delete_removes_excerpts_and_reports_missing() {
        let mut lib = Library::open_in_memory().unwrap();
        let a = import(&mut lib, "a", &[ex("a0"), ex("a1")]);
        lib.delete(a.id).unwrap();
        assert!(lib.list().unwrap().iter().all(|d| d.id != a.id));
        let left: i64 = lib.conn.query_row("SELECT COUNT(*) FROM excerpts WHERE dataset_id = ?1", [a.id], |r| r.get(0)).unwrap();
        assert_eq!(left, 0, "外键级联应删除摘抄");
        assert!(lib.delete(a.id).unwrap_err().contains("不存在"));
        assert!(lib.set_active(a.id, true).unwrap_err().contains("不存在"));
        assert!(lib.name_of(a.id).is_err());
    }

    #[test]
    fn deleting_everything_yields_none() {
        let mut lib = Library::open_in_memory().unwrap();
        for d in lib.list().unwrap() {
            lib.delete(d.id).unwrap();
        }
        assert_eq!(lib.random(7).unwrap(), None);
    }

    #[test]
    fn reopen_keeps_state_and_does_not_reseed() {
        let dir = std::env::temp_dir().join(format!("excerpts-lib-{}", std::process::id()));
        let path = dir.join("nested").join("library.db");
        let _ = std::fs::remove_dir_all(&dir);
        {
            let mut lib = Library::open(&path).unwrap();
            let sample_id = lib.list().unwrap()[0].id;
            lib.delete(sample_id).unwrap();
            let a = import(&mut lib, "a", &[ex("a0")]);
            lib.set_active(a.id, false).unwrap();
        }
        {
            let lib = Library::open(&path).unwrap();
            let list = lib.list().unwrap();
            assert_eq!(list.len(), 1, "删掉的示例不应在重新打开时补回");
            assert_eq!((list[0].name.as_str(), list[0].active), ("a", false));
        }
        {
            let conn = Connection::open(&path).unwrap();
            conn.pragma_update(None, "user_version", DB_SCHEMA_VERSION + 1).unwrap();
        }
        assert!(Library::open(&path).err().unwrap().contains("升级应用"));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
