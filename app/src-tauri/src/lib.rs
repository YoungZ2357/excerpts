mod cards;
mod dirs;
mod library;

use std::collections::hash_map::RandomState;
use std::hash::BuildHasher;
use std::path::PathBuf;
use std::sync::Mutex;
use dirs::AppDirs;
use library::{DatasetInfo, Excerpt, Library};
use tauri::{AppHandle, Manager, WebviewWindowBuilder};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_opener::OpenerExt;

/// 数据库句柄；打开失败时保存错误信息，由各命令返回给前端显示
struct LibraryState(Mutex<Result<Library, String>>);

/// 启动时确定的数据目录（见 dirs.rs）；定位失败时保存错误信息
struct DirsState(Result<AppDirs, String>);

fn random_u64() -> u64 {
    RandomState::new().hash_one(std::time::SystemTime::now())
}

fn with_library<T>(app: &AppHandle, f: impl FnOnce(&mut Library) -> Result<T, String>) -> Result<T, String> {
    let state = app.state::<LibraryState>();
    let mut guard = state.0.lock().map_err(|_| "数据库状态已损坏，请重启应用".to_string())?;
    match guard.as_mut() {
        Ok(lib) => f(lib),
        Err(e) => Err(e.clone()),
    }
}

#[tauri::command]
fn random_excerpt(app: AppHandle) -> Result<Option<Excerpt>, String> {
    with_library(&app, |lib| lib.random(random_u64()))
}

#[tauri::command]
fn list_datasets(app: AppHandle) -> Result<Vec<DatasetInfo>, String> {
    with_library(&app, |lib| lib.list())
}

#[tauri::command]
fn set_dataset_active(app: AppHandle, id: i64, active: bool) -> Result<(), String> {
    with_library(&app, |lib| lib.set_active(id, active))
}

/// 弹出文件选择框并导入所选文件；用户取消时返回 None。
/// 文件选择与解析都在 Rust 侧完成，前端无需任何文件系统权限。
/// 声明为 async 使其不在主线程运行，阻塞式对话框才不会卡死窗口。
#[tauri::command]
async fn import_dataset(app: AppHandle) -> Result<Option<DatasetInfo>, String> {
    let mut picker = app.dialog().file().set_title("导入数据集").add_filter("摘抄数据（JSON）", &["json"]);
    if let Some(window) = app.get_webview_window("main") {
        picker = picker.set_parent(&window);
    }
    let Some(file) = picker.blocking_pick_file() else { return Ok(None) };
    let path = file.into_path().map_err(|e| format!("无法识别所选文件：{e}"))?;

    let size = std::fs::metadata(&path).map_err(|e| format!("无法读取文件：{e}"))?.len();
    if size > library::MAX_DATASET_FILE_BYTES {
        return Err(format!("文件超过 {} MB", library::MAX_DATASET_FILE_BYTES / 1024 / 1024));
    }
    let bytes = std::fs::read(&path).map_err(|e| format!("无法读取文件：{e}"))?;
    let hash = library::content_hash(&bytes);
    if let Some(existing) = with_library(&app, |lib| lib.find_by_hash(&hash))? {
        return Err(format!("该文件已导入为「{existing}」"));
    }
    // 解析可能较慢，放在锁外进行，期间仍可正常抽句
    let items = library::parse_dataset(&bytes)?;
    drop(bytes);
    let name = path.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
    with_library(&app, |lib| lib.insert_dataset(&name, &hash, &items)).map(Some)
}

/// 确认后删除数据集；用户取消时返回 false
#[tauri::command]
async fn delete_dataset(app: AppHandle, id: i64) -> Result<bool, String> {
    let name = with_library(&app, |lib| lib.name_of(id))?;
    let mut dialog = app
        .dialog()
        .message(format!("确定删除数据集「{name}」吗？\n删除后无法恢复，需要时可重新导入原文件。"))
        .title("删除数据集")
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancelCustom("删除".into(), "取消".into()));
    if let Some(window) = app.get_webview_window("main") {
        dialog = dialog.parent(&window);
    }
    if !dialog.blocking_show() {
        return Ok(false);
    }
    with_library(&app, |lib| lib.delete(id))?;
    Ok(true)
}

fn config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.state::<DirsState>().0.as_ref().map(|d| d.config.clone()).map_err(Clone::clone)
}

fn cards_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(config_dir(app)?.join("cards"))
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(config_dir(app)?.join("settings.json"))
}

/// 读取 `<配置目录>/cards/*.json`，内容校验由前端完成
#[tauri::command]
fn list_user_cards(app: AppHandle) -> Result<Vec<cards::UserCardFile>, String> {
    Ok(cards::scan_cards_dir(&cards_dir(&app)?))
}

#[tauri::command]
fn get_settings(app: AppHandle) -> Result<cards::Settings, String> {
    Ok(cards::load_settings(&settings_path(&app)?))
}

#[tauri::command]
fn set_settings(app: AppHandle, settings: cards::Settings) -> Result<(), String> {
    cards::save_settings(&settings_path(&app)?, &settings).map_err(|e| format!("保存设置失败：{e}"))
}

/// 用系统文件管理器打开卡片目录，不存在时先创建
#[tauri::command]
fn open_cards_dir(app: AppHandle) -> Result<(), String> {
    let dir = cards_dir(&app)?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("无法创建卡片目录：{e}"))?;
    app.opener()
        .open_path(dir.to_string_lossy(), None::<&str>)
        .map_err(|e| format!("无法打开卡片目录：{e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let dirs = AppDirs::resolve(app.handle());
            let library = dirs.clone().and_then(|d| Library::open(&d.data.join("library.db")));
            if let Err(e) = &library {
                eprintln!("[library] {e}");
            }

            // 窗口在 tauri.conf.json 中设为 create: false，这里手动创建，以便便携版指定 WebView2 数据目录。
            // 数据目录无法创建（例如 exe 放在只读位置）时退回默认位置，保证窗口能打开并显示错误信息。
            let config = app.config().app.windows.first().cloned().ok_or("tauri.conf.json 中缺少窗口配置")?;
            let mut window = WebviewWindowBuilder::from_config(app.handle(), &config)?;
            if let Ok(AppDirs { webview: Some(dir), .. }) = &dirs {
                match std::fs::create_dir_all(dir) {
                    Ok(()) => window = window.data_directory(dir.clone()),
                    Err(e) => eprintln!("[dirs] 无法创建 {}，WebView 数据使用默认位置：{e}", dir.display()),
                }
            }
            window.build()?;

            app.manage(DirsState(dirs));
            app.manage(LibraryState(Mutex::new(library)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            random_excerpt,
            list_datasets,
            set_dataset_active,
            import_dataset,
            delete_dataset,
            list_user_cards,
            get_settings,
            set_settings,
            open_cards_dir,
        ])
        .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
