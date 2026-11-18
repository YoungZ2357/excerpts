import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import type { Excerpt } from "@excerpts/schema";


const ROOT = process.argv[2];
const BOOK = process.argv[3];
const OUT = process.argv[4];

async function* leafDirs(dir: string): AsyncGenerator<string> {
    const entries = await readdir(dir, { withFileTypes: true });
    if (entries.some((e) => e.isFile() && e.name === "source.txt")) yield dir;
    for (const e  of entries) if (e.isDirectory()) yield* leafDirs(join(dir, e.name));
}

const lines = async (p: string) => (await readFile(p, "utf8")).split(/\r?\n/)
    .map((line) => line.trim());

const out: Excerpt[] = [];
for await (const dir of leafDirs(join(ROOT, BOOK))) {
    const path = relative(ROOT, dir).split(sep);
    const src = await lines(join(dir, "source.txt"));
    const tgt = await lines(join(dir, "target.txt"));
    if (src.length !== tgt.length) {
        console.warn(`行数不一致，跳过 ${dir} (${src.length} vs ${tgt.length})`);
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
            source: path[0]
        });
    })
}

await writeFile(OUT, JSON.stringify(out, null, 2), "utf8");
console.log(`写出 ${out.length} 条 -> ${OUT}`);