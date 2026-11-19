import { writeFile } from "node:fs/promises";
import { ingestNiutrans } from "./ingest-niutrans.ts";

const [root, book, out] = process.argv.slice(2);
if (!root || !book || !out) {
    console.error("用法: npm run pipeline -- <NiuTrans 根目录> <书名目录> <输出 JSON 路径>");
    process.exit(1);
}

const excerpts = await ingestNiutrans(root, book);
await writeFile(out, JSON.stringify(excerpts, null, 2), "utf8");
console.log(`写出 ${excerpts.length} 条 -> ${out}`);
