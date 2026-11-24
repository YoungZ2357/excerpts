import sourceHanSerifLicense from "../assets/fonts/LICENSE-SourceHanSerif.txt?raw";

/** 随应用再分发的第三方内容；与仓库根目录的 THIRD_PARTY_NOTICES.md 保持一致 */
export interface ThirdPartyNotice {
    name: string;
    version: string;
    copyright: string;
    license: string;
    url: string;
    /** 再分发时做过的处理 */
    note?: string;
    /** 许可证全文（含版权声明） */
    text: string;
}

export const NOTICES: ThirdPartyNotice[] = [
    {
        name: "思源宋体 Source Han Serif SC（Light、Bold）",
        version: "1.001",
        copyright: "Copyright © 2017 Adobe Systems Incorporated (http://www.adobe.com/), with Reserved Font Name 'Source'.",
        license: "SIL Open Font License 1.1",
        url: "https://github.com/adobe-fonts/source-han-serif",
        note: "由原始 OTF 无损转换为 WOFF2 后打包：字形与各数据表未作改动，仅按 WOFF2 规范移除 DSIG 签名表并设置 head 表的转换标志位。",
        text: sourceHanSerifLicense,
    },
];
