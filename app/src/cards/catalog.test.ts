import { describe, expect, it } from "vitest";
import { CARD_SCHEMA_VERSION } from "@excerpts/schema";
import { BUILTIN_CARDS, buildCatalog, makeResolveContext } from "./catalog.ts";
import { resolveCard } from "./style/resolve.ts";

const hasLayout = (id: string) => id === "classic";

describe("buildCatalog", () => {
    it("没有用户卡片时只有内置卡片，classic 排第一", () => {
        const c = buildCatalog(BUILTIN_CARDS, []);
        expect(c.entries.map((e) => e.id)).toEqual(["classic", "naive"]);
        expect(c.entries.every((e) => e.builtin)).toBe(true);
        expect(c.warnings).toEqual([]);
    });

    it("用户卡片排在内置卡片之后，名称取自 name 字段，缺失时用 id", () => {
        const c = buildCatalog(BUILTIN_CARDS, [
            { file: "kaiti.json", id: "kaiti", card: { schemaVersion: CARD_SCHEMA_VERSION, id: "kaiti", name: "楷体" } },
            { file: "plain.json", id: "plain", card: { schemaVersion: CARD_SCHEMA_VERSION, id: "plain" } },
        ]);
        expect(c.entries.slice(2)).toEqual([
            { id: "kaiti", name: "楷体", builtin: false },
            { id: "plain", name: "plain", builtin: false },
        ]);
    });

    it("读取失败的文件转为 warning，不出现在列表中", () => {
        const c = buildCatalog(BUILTIN_CARDS, [
            { file: "broken.json", error: "JSON 格式错误" },
            { file: "*", error: "卡片文件过多" },
        ]);
        expect(c.entries).toHaveLength(BUILTIN_CARDS.length);
        expect(c.warnings).toEqual(["broken.json：JSON 格式错误", "卡片文件过多"]);
    });

    it("与内置卡片重名的用户卡片被忽略", () => {
        const c = buildCatalog(BUILTIN_CARDS, [
            { file: "classic.json", id: "classic", card: { schemaVersion: CARD_SCHEMA_VERSION, id: "classic", name: "假经典" } },
        ]);
        expect(c.entries.find((e) => e.id === "classic")?.name).toBe("经典");
        expect(c.warnings).toHaveLength(1);
        expect(c.warnings[0]).toContain("重名");
    });

    it("用户卡片可以继承内置卡片", () => {
        const c = buildCatalog(BUILTIN_CARDS, [
            { file: "big.json", id: "big", card: { schemaVersion: CARD_SCHEMA_VERSION, id: "big", name: "大字", extends: "naive", style: { slots: { text: { fontSize: 48 } } } } },
        ]);
        const r = resolveCard("big", makeResolveContext(c, hasLayout));
        expect(r.warnings).toEqual([]);
        expect(r.style.slots.text.fontSize).toBe(48);
        expect(r.style.slots.text.align).toBe("center");
        expect(r.style.slots.translation.visible).toBe(false);
    });
});

describe("内置卡片", () => {
    it("每张内置卡片都能无 warning 地解析", () => {
        const ctx = makeResolveContext(buildCatalog(BUILTIN_CARDS, []), hasLayout);
        for (const def of BUILTIN_CARDS) {
            const r = resolveCard(def.id, ctx);
            expect(r.id, def.id).toBe(def.id);
            expect(r.warnings, def.id).toEqual([]);
        }
    });

    it("naive 只显示原文，居中、大字号", () => {
        const r = resolveCard("naive", makeResolveContext(buildCatalog(BUILTIN_CARDS, []), hasLayout));
        const { text, translation, source, path } = r.style.slots;
        expect(text.visible).toBe(true);
        expect(text.align).toBe("center");
        expect(text.position).toEqual({ x: 50, y: 50, anchor: "center" });
        expect(text.fontSize).toBeGreaterThan(r.style.slots.translation.fontSize);
        expect([translation.visible, source.visible, path.visible]).toEqual([false, false, false]);
    });

    it("选中的卡片不存在时回退到 classic", () => {
        const r = resolveCard("deleted", makeResolveContext(buildCatalog(BUILTIN_CARDS, []), hasLayout));
        expect(r.id).toBe("classic");
        expect(r.warnings).toHaveLength(1);
    });
});
