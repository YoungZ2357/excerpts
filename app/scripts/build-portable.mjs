// 构建便携版：单个 exe，所有数据写在 exe 同目录的 ExcerptsData 中（见 src-tauri/src/dirs.rs）。
// 产物：src-tauri/target/release/bundle/portable/Excerpts_<版本>_x64-portable.exe
// 使用单独的 target 目录（target/portable），不会覆盖安装版的 app.exe，也不受正在运行的 app.exe 占用影响。
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const tauriDir = join(appDir, "src-tauri");
const { version } = JSON.parse(readFileSync(join(tauriDir, "tauri.conf.json"), "utf8"));
const targetDir = join(tauriDir, "target", "portable");

// 参数是固定字符串，用 shell 执行整条命令（Windows 上 npm 是 .cmd，需要 shell）
const result = spawnSync("npm run tauri -- build --no-bundle --features portable", {
    cwd: appDir,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, CARGO_TARGET_DIR: targetDir },
});
if (result.status !== 0) process.exit(result.status ?? 1);

const outDir = join(tauriDir, "target", "release", "bundle", "portable");
const out = join(outDir, `Excerpts_${version}_x64-portable.exe`);
mkdirSync(outDir, { recursive: true });
copyFileSync(join(targetDir, "release", "app.exe"), out);
console.log(`便携版 -> ${out}`);
