import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Excerpt } from "@excerpts/schema";
import { ingestNiutrans } from "../src/ingest-niutrans.ts";

/**
 * NiuTrans 格式契约测试：只断言"该格式输入 → Excerpt 输出"的行为，不依赖解析实现细节。
 * fixture 在临时目录中按字节生成，避免 git autocrlf 等改写 BOM / 换行符。
 */

let root: string;
let result: Excerpt[];
let warnings: string[];

async function leaf(rel: string[], source: string, target: string) {
    const dir = join(root, ...rel);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "source.txt"), source, "utf8");
    await writeFile(join(dir, "target.txt"), target, "utf8");
}

const byId = (id: string) => result.find((e) => e.id === id);

beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "niutrans-"));
    // 常规章节，包含中间空行与空译文
    await leaf(["老子", "道经", "第一章"],
        "道可道，非常道。\n\n名可名，非常名。\n无名天地之始。",
        "道如果可以言说，就不是永恒的道。\n\n名如果可以命名，就不是永恒的名。\n");
    // CRLF + BOM
    await leaf(["老子", "德经", "第三十八章"],
        "\uFEFF上德不德，是以有德。\r\n下德不失德，是以无德。",
        "\uFEFF上德之人不自恃有德，所以有德。\r\n下德之人恪守形式上的德，所以无德。");
    // 行数不一致
    await leaf(["老子", "德经", "第三十九章"], "昔之得一者\n天得一以清", "从来得到一的");
    // 其他书目不应被导入
    await leaf(["庄子", "内篇", "逍遥游"], "北冥有鱼", "北方大海里有一条鱼");

    warnings = [];
    result = await ingestNiutrans(root, "老子", (m) => warnings.push(m));
});

afterAll(async () => {
    await rm(root, { recursive: true, force: true });
});

describe("ingestNiutrans", () => {
    it("只导入指定书目的叶子目录", () => {
        expect(result.every((e) => e.source === "老子")).toBe(true);
        expect(result.some((e) => e.text.includes("北冥"))).toBe(false);
    });

    it("生成符合 schema 的条目，path 为相对根目录的层级", () => {
        expect(byId("老子/道经/第一章#0")).toEqual({
            id: "老子/道经/第一章#0",
            text: "道可道，非常道。",
            translation: "道如果可以言说，就不是永恒的道。",
            lang: "lzh",
            path: ["老子", "道经", "第一章"],
            source: "老子",
        });
    });

    it("id 使用原始行号：跳过空行不影响后续行号", () => {
        const ids = result.filter((e) => e.path[2] === "第一章").map((e) => e.id);
        expect(ids).toEqual(["老子/道经/第一章#0", "老子/道经/第一章#2", "老子/道经/第一章#3"]);
    });

    it("译文为空时 translation 为 undefined", () => {
        expect(byId("老子/道经/第一章#3")?.translation).toBeUndefined();
    });

    it("id 跨平台一致：统一使用 / 分隔，不含反斜杠", () => {
        expect(result.every((e) => !e.id.includes("\\"))).toBe(true);
        expect(result.every((e) => e.path.every((p) => !p.includes("/") && !p.includes("\\")))).toBe(true);
    });

    it("兼容 CRLF 与 UTF-8 BOM", () => {
        expect(byId("老子/德经/第三十八章#0")?.text).toBe("上德不德，是以有德。");
        expect(byId("老子/德经/第三十八章#0")?.translation).toBe("上德之人不自恃有德，所以有德。");
        expect(byId("老子/德经/第三十八章#1")?.text).toBe("下德不失德，是以无德。");
        expect(result.every((e) => !e.text.includes("\uFEFF") && !e.text.includes("\r"))).toBe(true);
    });

    it("id 唯一", () => {
        expect(new Set(result.map((e) => e.id)).size).toBe(result.length);
    });

    it("行数不一致的目录被跳过并给出警告", () => {
        expect(result.some((e) => e.path[2] === "第三十九章")).toBe(false);
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain("第三十九章");
    });

    it("重复导入结果完全一致", async () => {
        expect(await ingestNiutrans(root, "老子", () => {})).toEqual(result);
    });
});
