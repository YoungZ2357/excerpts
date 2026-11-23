import { SLOT_IDS, type ResolvedCardStyle } from "@excerpts/schema";

/**
 * 打包字体清单（assets/fonts/fonts.json）的解析，以及卡片用到的打包字体的收集。
 * 纯函数，不依赖浏览器，便于测试。
 */

export interface FontFaceSpec {
    family: string;
    file: string;
    url: string;
    weight: number;
    style: "normal" | "italic";
}

export interface FontManifestResult {
    faces: FontFaceSpec[];
    warnings: string[];
}

/** 与 resolve.ts 中字体名的规则一致：不含引号、反斜杠、分号、花括号、尖括号 */
export const FONT_NAME = /^[^"\\;{}<>]{1,64}$/;

const MANIFEST = "fonts.json";

/**
 * @param raw   fonts.json 的内容；undefined 表示没有清单
 * @param files 字体目录中实际存在的文件：文件名 → 打包后的 URL
 */
export function parseFontManifest(raw: unknown, files: ReadonlyMap<string, string>): FontManifestResult {
    const faces: FontFaceSpec[] = [];
    const warnings: string[] = [];

    if (raw === undefined) {
        if (files.size > 0) warnings.push(`字体目录中有 ${files.size} 个字体文件，但缺少 ${MANIFEST}，均未启用`);
        return { faces, warnings };
    }
    if (!Array.isArray(raw)) {
        warnings.push(`${MANIFEST} 应为数组，字体均未启用`);
        return { faces, warnings };
    }

    const used = new Set<string>();
    const seen = new Set<string>();

    raw.forEach((entry: unknown, i) => {
        const at = `${MANIFEST} 第 ${i + 1} 项`;
        if (typeof entry !== "object" || entry === null) {
            warnings.push(`${at} 应为对象，已忽略`);
            return;
        }
        const e = entry as Record<string, unknown>;

        const family = typeof e.family === "string" ? e.family.trim() : "";
        if (!FONT_NAME.test(family)) {
            warnings.push(`${at} 的 family 缺失或含有非法字符，已忽略`);
            return;
        }
        if (typeof e.file !== "string") {
            warnings.push(`${at} 缺少 file，已忽略`);
            return;
        }
        const url = files.get(e.file);
        if (url === undefined) {
            warnings.push(`${at} 的文件 ${e.file} 不存在（只支持 woff2 / woff / ttf / otf），已忽略`);
            return;
        }

        let weight = 400;
        if (e.weight !== undefined) {
            if (typeof e.weight === "number" && Number.isInteger(e.weight) && e.weight >= 1 && e.weight <= 1000) {
                weight = e.weight;
            } else {
                warnings.push(`${at} 的 weight 应为 1 ~ 1000 的整数，已按 400 处理`);
            }
        }

        let style: FontFaceSpec["style"] = "normal";
        if (e.style !== undefined) {
            if (e.style === "normal" || e.style === "italic") style = e.style;
            else warnings.push(`${at} 的 style 应为 normal 或 italic，已按 normal 处理`);
        }

        const key = `${family.toLowerCase()}|${weight}|${style}`;
        if (seen.has(key)) {
            warnings.push(`${at}：${family} ${weight} ${style} 重复登记，已忽略`);
            return;
        }
        seen.add(key);
        used.add(e.file);
        faces.push({ family, file: e.file, url, weight, style });
    });

    for (const file of files.keys()) {
        if (!used.has(file)) warnings.push(`字体文件 ${file} 未在 ${MANIFEST} 中登记，未启用`);
    }

    return { faces, warnings };
}

/**
 * 收集卡片中可见元素需要等待加载的打包字体，返回 document.fonts.load 可用的描述串（如 `300 16px "Source Han Serif SC"`）。
 *
 * 只收集字体栈最前面连续的打包字体：一旦遇到非打包字体（可能已安装），后面的字体都只是备选。
 * 例如 ["KaiTi", "Source Han Serif SC", ...] 不会等待思源宋体——若楷体已安装就根本用不到它，
 * 若未安装，浏览器也会在需要时自行加载并替换。
 */
export function collectFontLoads(style: ResolvedCardStyle, bundledFamilies: ReadonlySet<string>): string[] {
    const loads = new Set<string>();
    for (const id of SLOT_IDS) {
        const slot = style.slots[id];
        if (!slot.visible) continue;
        for (const family of slot.fontFamily) {
            if (!bundledFamilies.has(family.toLowerCase())) break;
            loads.add(`${slot.fontWeight} 16px "${family}"`);
        }
    }
    return [...loads];
}
