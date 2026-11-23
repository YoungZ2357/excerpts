import type { ResolvedCardStyle } from "@excerpts/schema";
import { collectFontLoads, parseFontManifest, type FontManifestResult } from "./manifest.ts";

/**
 * 打包字体：app/src/assets/fonts 下的字体文件 + fonts.json 清单。
 * 只匹配该目录第一层的文件，source/ 等子目录中的原始字体不会被打包。
 * 目录不存在或为空时什么也不做（该目录未纳入 git，新 clone 的仓库中可能没有）。
 */

const fileUrls = import.meta.glob<string>("../../assets/fonts/*.{woff2,woff,ttf,otf}", {
    query: "?url",
    import: "default",
    eager: true,
});

const manifests = import.meta.glob<unknown>("../../assets/fonts/fonts.json", {
    import: "default",
    eager: true,
});

const basename = (path: string) => path.slice(path.lastIndexOf("/") + 1);

/** 加载字体的最长等待时间，超时先显示卡片，字体加载完后浏览器会自动替换 */
export const FONT_LOAD_TIMEOUT_MS = 1500;

let registered: (FontManifestResult & { families: Set<string> }) | null = null;

/** 按清单注册打包字体（只注册一次）；注册不会下载文件，用到时才加载 */
export function registerBundledFonts(): FontManifestResult {
    if (registered) return registered;

    const files = new Map(Object.entries(fileUrls).map(([path, url]) => [basename(path), url]));
    const result = parseFontManifest(Object.values(manifests)[0], files);
    const families = new Set<string>();

    for (const f of result.faces) {
        try {
            const face = new FontFace(f.family, `url("${f.url}")`, {
                weight: String(f.weight),
                style: f.style,
                display: "swap",
            });
            document.fonts.add(face);
            families.add(f.family.toLowerCase());
        } catch (e) {
            result.warnings.push(`注册字体 ${f.file} 失败：${String(e)}`);
        }
    }

    registered = { ...result, families };
    return registered;
}

/** 等待卡片用到的打包字体加载完成；失败或超时都会正常返回，不阻塞显示 */
export async function waitForCardFonts(style: ResolvedCardStyle): Promise<void> {
    const { families } = registered ?? { families: new Set<string>() };
    const loads = collectFontLoads(style, families);
    if (loads.length === 0) return;

    const all = Promise.all(loads.map((l) => document.fonts.load(l).catch(() => [])));
    const timeout = new Promise((resolve) => setTimeout(resolve, FONT_LOAD_TIMEOUT_MS));
    await Promise.race([all, timeout]);
}
