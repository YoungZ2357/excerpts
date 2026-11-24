# 第三方许可声明

Excerpts 的发布版本（安装版与便携版）中再分发了以下第三方内容。应用内可通过右键菜单「关于与许可…」查看同样的信息与许可证全文。

## 思源宋体 Source Han Serif SC

| 项目 | 内容 |
|---|---|
| 文件 | `app/src/assets/fonts/SourceHanSerifSC-Light.woff2`、`SourceHanSerifSC-Bold.woff2`（打包进应用） |
| 版本 | 1.001 |
| 版权 | Copyright © 2017 Adobe Systems Incorporated (http://www.adobe.com/), with Reserved Font Name 'Source'. |
| 许可 | SIL Open Font License, Version 1.1，全文见 [`app/src/assets/fonts/LICENSE-SourceHanSerif.txt`](app/src/assets/fonts/LICENSE-SourceHanSerif.txt) |
| 来源 | https://github.com/adobe-fonts/source-han-serif （许可证文本取自标签 `1.001R` 的 `LICENSE.txt`，版权声明取自字体文件的 name 表） |
| 商标 | Source is a trademark of Adobe Systems Incorporated in the United States and/or other countries. |

**再分发时的处理**：由官方 OTF 使用 fontTools 无损转换为 WOFF2，保留原始时间戳。字形、字符映射、排版特性与 name 表（含版权与许可信息）均未改动，仅按 WOFF2 规范移除了 DSIG 签名表并设置 `head.flags` 的无损转换标志位。未做子集化，因此沿用原字体名称。

> 若今后对字体做子集化或其他修改，按 OFL 第 3 条，修改后的字体不得再使用保留字体名 "Source"，需同时修改字体内部名称与 `fonts.json` / 卡片中引用的字体名，并继续随附本许可证。
