//! 应用的数据目录。
//!
//! - 安装版：卡片与设置在系统配置目录（Windows：`%APPDATA%\<identifier>`），
//!   数据集与 WebView2 缓存在本地数据目录（Windows：`%LOCALAPPDATA%\<identifier>`）；
//! - 便携版（启用 `portable` feature 编译）：以上内容全部放在 exe 同目录的 `ExcerptsData` 中，
//!   不在系统目录里留下任何文件，复制 exe 和这个文件夹即可整体搬走。

use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

/// 便携版的数据文件夹名，位于 exe 同目录
pub const PORTABLE_DIR_NAME: &str = "ExcerptsData";

#[derive(Clone, Debug, PartialEq)]
pub struct AppDirs {
    /// 卡片目录与 settings.json 所在目录
    pub config: PathBuf,
    /// library.db 所在目录
    pub data: PathBuf,
    /// WebView2 用户数据目录；None 表示使用 Tauri 默认位置（本地数据目录）
    pub webview: Option<PathBuf>,
}

impl AppDirs {
    pub fn portable_in(base: &Path) -> Self {
        Self { config: base.to_path_buf(), data: base.to_path_buf(), webview: Some(base.join("webview")) }
    }

    pub fn resolve(app: &AppHandle) -> Result<Self, String> {
        if cfg!(feature = "portable") {
            let exe = std::env::current_exe().map_err(|e| format!("无法定位程序位置：{e}"))?;
            let dir = exe.parent().ok_or("无法定位程序所在目录")?;
            Ok(Self::portable_in(&dir.join(PORTABLE_DIR_NAME)))
        } else {
            let path = app.path();
            Ok(Self {
                config: path.app_config_dir().map_err(|e| format!("无法定位配置目录：{e}"))?,
                data: path.app_local_data_dir().map_err(|e| format!("无法定位数据目录：{e}"))?,
                webview: None,
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn portable_keeps_everything_under_base() {
        let base = Path::new("D:/apps/ExcerptsData");
        let dirs = AppDirs::portable_in(base);
        assert_eq!(dirs.config, base);
        assert_eq!(dirs.data, base);
        assert_eq!(dirs.webview.as_deref(), Some(base.join("webview").as_path()));
    }
}
