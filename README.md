<h1 align="center">Excerpt</h1>

<p align="center">
<em>Excerpt 是一个基于Tarui和React-ts的随机句子应用，允许自定义展示卡片和摄入指定格式的文本</em>
</p>


## 安装

在 [Releases](https://github.com/YoungZ2357/excerpts/releases) 页面下载，两种形式任选其一：

| 文件 | 说明 |
|---|---|
| `Excerpts_<版本>_x64-setup.exe` | 安装版。安装到当前用户，无需管理员权限；数据保存在系统用户目录中 |
| `Excerpts_<版本>_x64-portable.exe` | 便携版。单个 exe，双击即用，无需安装；所有数据保存在 exe 同目录的 `ExcerptsData` 文件夹中，不写入系统目录 |

> - 程序暂未签名，Windows SmartScreen 可能提示"已保护你的电脑"，点击「更多信息 → 仍要运行」即可。
> - 需要 Microsoft Edge WebView2 运行时。Windows 11 自带，多数 Windows 10 已通过系统更新安装；安装版会在缺失时自动安装，便携版不会，缺失时请先从微软官网安装 WebView2。
> - 便携版请放在有写入权限的位置（如桌面、U 盘），不要放在 `C:\Program Files` 下。搬到别处时连同 `ExcerptsData` 一起复制，即可保留数据集、卡片与设置。

目前只提供 Windows 版本。自行构建：

```sh
npm ci
npm run build            # 安装版，产物位于 app/src-tauri/target/release/bundle/nsis
npm run build:portable   # 便携版，产物位于 app/src-tauri/target/release/bundle/portable
```

## 数据集

> 完整说明见 [数据集使用指南](docs/datasets.md)。

右键 →「数据集」可以导入 JSON 格式的摘抄文件、勾选启用的数据集（同时勾选多个即可合并抽句）、删除数据集。启用状态会被记住。数据保存在 `library.db`（SQLite）中：安装版位于 `%LOCALAPPDATA%\io.github.YoungZ2357.excerpts\`，便携版位于 exe 旁的 `ExcerptsData\`。首次启动自带一个「示例」数据集。

## 自定义卡片

> 面向使用者的完整说明见 [卡片使用指南](docs/cards.md)。

在卡片上**右键**可以切换卡片、管理数据集、重新加载卡片、打开卡片文件夹。左键点击切换到下一条摘抄。

内置卡片：

| id | 名称 | 说明 |
|---|---|---|
| `classic` | 经典 | 默认卡片，也是所有卡片的兜底样式；使用打包的思源宋体，原文 Bold、译文与来源 Light；修改它的数值会影响所有未覆盖这些字段的卡片 |
| `naive` | 极简 | 只显示原文，居中、大字号 |
| `vertical` | 纵向 | 竖长卡片：原文竖排、出处为左上角印章，虚线下方为译文，右下角显示章节 |

### 添加自己的卡片

1. 右键 →「打开卡片文件夹」。文件夹位置（便携版为 exe 旁的 `ExcerptsData\cards`）：
   - Windows：`%APPDATA%\io.github.YoungZ2357.excerpts\cards`
   - macOS：`~/Library/Application Support/io.github.YoungZ2357.excerpts/cards`
   - Linux：`~/.config/io.github.YoungZ2357.excerpts/cards`
2. 新建一个 UTF-8 编码的 `.json` 文件。**文件名就是卡片 id**，只能用小写字母、数字、`-`、`_`，且不能与内置卡片重名。
3. 右键 →「重新加载卡片」，在菜单中选中它。选中的卡片会记在同目录上一级的 `settings.json` 中，重启后保留。

卡片只需写出与父卡片不同的部分，其余字段自动继承（默认继承 `classic`）：

```json
{
  "schemaVersion": 1,
  "id": "kaiti",
  "name": "楷体竖排",
  "extends": "classic",
  "style": {
    "size": { "width": 480, "height": 360 },
    "padding": [24, 28],
    "background": "#f4efe4",
    "base": { "fontFamily": ["KaiTi", "STKaiti"], "color": "#2b2b2b" },
    "slots": {
      "text": { "fontSize": 28, "letterSpacing": 0.1, "writingMode": "vertical" },
      "translation": { "fontSize": 14, "lineHeight": 1.8 },
      "source": { "position": { "x": 95, "y": 95, "anchor": "bottom-right" } }
    }
  }
}
```

### 字段

| 层级 | 字段 |
|---|---|
| 卡片 `style` | `size`（`{ width, height }`，逻辑像素，同时决定窗口大小，范围 200×120 ~ 7680×4320）、`padding`（`[上下, 左右]`，px）、`gap`（元素间距，px）、`background`、`radius`（圆角，px） |
| 元素（`base` 对所有元素生效，`slots.<元素>` 单独设置，优先级更高） | `fontFamily`（字体名数组）、`fontSize`（px）、`fontWeight`、`lineHeight`（倍数）、`letterSpacing`（em）、`color`、`opacity`（0 ~ 1）、`align`（`left` / `center` / `right` / `justify`）、`writingMode`（`horizontal` / `vertical`）、`visible` |
| 仅 `slots.<元素>` | `position`（`{ x, y, anchor }`，x、y 为卡片宽高的百分比，`anchor` 为 `top-left` / `center` / `bottom-right`）、`maxWidth`（卡片宽度的百分比） |

元素有 `text`（原文）、`translation`（译文）、`source`（来源）、`path`（目录层级，默认隐藏）。

### 打包字体

放在 `app/src/assets/fonts/` 第一层的字体文件（woff2 / woff / ttf / otf）会随应用打包，需在同目录的 `fonts.json` 中登记家族名与粗细后才会启用：

```json
[
  { "family": "Source Han Serif SC", "file": "SourceHanSerifSC-Light.woff2", "weight": 300 },
  { "family": "Source Han Serif SC", "file": "SourceHanSerifSC-Bold.woff2", "weight": 700 }
]
```

- `weight` 缺省为 400，`style` 可选 `normal`（缺省）/ `italic`。粗细与卡片中 `fontWeight` 不完全一致时，浏览器会选最接近的一档。
- 建议使用 woff2，体积更小；原始 otf/ttf 可放在 `source/` 子目录中留存，子目录不会被打包。
- 字体只在卡片用到时才加载；切换卡片时会等字体加载完（最多 1.5 秒）再显示新卡片。只等待字体栈中排在最前面的打包字体，排在已安装字体之后的打包字体只作备选，不会等待。
- 清单写错（文件不存在、粗细非法、未登记的字体文件等）会出现在右键菜单的「⚠ 卡片问题」中。
- 仓库中只收录 classic 使用的思源宋体 woff2、其许可证 `LICENSE-SourceHanSerif.txt` 与 `fonts.json`（见 `.gitignore`）；新增需随应用再分发的字体时，须同时附上其许可证，并在 `THIRD_PARTY_NOTICES.md` 与 `app/src/about/notices.ts` 中登记；新增的字体默认不入库，需要时在 `.gitignore` 中加入对应的 `!` 规则。字体缺失时，引用它们的卡片会退回已安装的字体。

### 注意

- `fontFamily` 里写字体的**家族名**（如 `KaiTi`、`Source Han Serif SC`），不是文件名。打包字体与系统已安装字体写法相同：名字匹配到打包字体时用打包的文件，否则按已安装字体查找，最后用 classic 的字体兜底。字体名写错不会报错，只会落到后面的字体上。
- 合并顺序为 classic → 父卡片 → 当前卡片；同一层内 `slots` 覆盖 `base`，后一层的 `base` 覆盖前一层的 `slots`。
- 写错不会导致崩溃：非法字段只回退该字段，文件无法读取或 `schemaVersion` 不对时整张卡片回退到 classic，父卡片不存在时直接继承 classic。出现问题时右键菜单会显示「⚠ 有 N 个卡片问题…」，点开可查看详情。

## 开发相关
TBD

[//]: # (测试覆盖相关)


### 开发计划

1. linting, 测试覆盖, 硬编码行为扫描
2. NiuTrans的语料数据(不论bitext.txt还是source.txt&target.txt)存在句行不匹配，

## 第三方许可

发布版本内置了 Adobe 的思源宋体（Source Han Serif SC），以 SIL Open Font License 1.1 授权再分发。详见 [第三方许可声明](THIRD_PARTY_NOTICES.md)，应用内可通过右键 →「关于与许可…」查看许可证全文。
