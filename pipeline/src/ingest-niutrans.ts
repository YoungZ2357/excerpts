import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import type { Excerpt } from "@excerpts/schema";

/** 递归找出包含 source.txt 的目录，按名称排序以保证输出顺序稳定 */
async function* leafDirs(dir: string): AsyncGenerator<string> {
    const entries = (await readdir(dir, { withFileTypes: true }))
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)); // 按码点排序，不受系统 locale 影响
    if (entries.some((e) => e.isFile() && e.name === "source.txt")) yield dir;
    for (const e of entries) if (e.isDirectory()) yield* leafDirs(join(dir, e.name));
}

/** 读取文本并按行拆分；trim 同时会去掉行首的 UTF-8 BOM（U+FEFF 属于 ECMAScript 空白字符） */
const lines = async (p: string) => (await readFile(p, "utf8"))
    .split(/\r?\n/)
    .map((line) => line.trim());

/**
 * 解析 NiuTrans 古文语料目录：root/book/.../{source.txt,target.txt}
 * - id 为 `目录层级/...#原始行号`，空行跳过但不影响后续行号，保证重新导入时 id 稳定
 * - source.txt 与 target.txt 行数不一致的目录整体跳过
 */
export async function ingestNiutrans(
    root: string,
    book: string,
    onWarn: (msg: string) => void = console.warn,
): Promise<Excerpt[]> {
    const out: Excerpt[] = [];
    for await (const dir of leafDirs(join(root, book))) {
        const path = relative(root, dir).split(sep);
        const src = await lines(join(dir, "source.txt"));
        const tgt = await lines(join(dir, "target.txt"));
        if (src.length !== tgt.length) {
            onWarn(`行数不一致，跳过 ${dir} (${src.length} vs ${tgt.length})`);
            continue;
        }
        src.forEach((text, i) => {
            if (!text) return;
            out.push({
                id: `${path.join("/")}#${i}`,
                text,
                translation: tgt[i] || undefined,
                lang: "lzh",
                path,
                source: path[0],
            });
        });
    }
    return out;
}
