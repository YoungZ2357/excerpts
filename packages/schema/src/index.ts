export const SCHEMA_VERSION = 1;

export interface Excerpt {
    id: string;
    text: string;
    translation?: string;  // 当前版本，translation覆盖所有的翻译，只考虑进行了一次翻译
    lang: string;
    path: string[];  // 基于NiuTrans仓库构建，目录层级，如 ["老子", "道经", ...]
    source: string;
    extras?: Record<string, unknown>; //任何扩展内容
}