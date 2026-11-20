import { describe, expect, it } from "vitest";
import { CARD_SCHEMA_VERSION, SLOT_IDS } from "@excerpts/schema";
import { CLASSIC_STYLE } from "../presets/classic.ts";
import { MAX_EXTENDS_DEPTH, resolveCard, type ResolveContext } from "./resolve.ts";

const v = CARD_SCHEMA_VERSION;

function ctx(cards: Record<string, unknown>, layouts = ["classic"]): ResolveContext {
    return {
        getCard: (id) => cards[id],
        hasLayout: (id) => layouts.includes(id),
    };
}

describe("resolveCard", () => {
    it("classic 解析结果等于根样板，且没有 warning", () => {
        const r = resolveCard("classic", ctx({}));
        expect(r.id).toBe("classic");
        expect(r.layout).toBe("classic");
        expect(r.style).toEqual(CLASSIC_STYLE);
        expect(r.warnings).toEqual([]);
    });

    it("根样板每个插槽的字段都有值", () => {
        for (const id of SLOT_IDS) {
            for (const [key, value] of Object.entries(CLASSIC_STYLE.slots[id])) {
                if (key === "position" || key === "maxWidth") continue;
                expect(value, `${id}.${key}`).not.toBeUndefined();
            }
        }
    });

    it("用户卡片只覆盖写出的字段，其余继承 classic", () => {
        const r = resolveCard("mine", ctx({
            mine: { schemaVersion: v, id: "mine", name: "我的", style: { size: { width: 600, height: 400 }, slots: { text: { fontSize: 32 } } } },
        }));
        expect(r.warnings).toEqual([]);
        expect(r.style.size).toEqual({ width: 600, height: 400 });
        expect(r.style.slots.text.fontSize).toBe(32);
        expect(r.style.slots.text.lineHeight).toBe(CLASSIC_STYLE.slots.text.lineHeight);
        expect(r.style.slots.source).toEqual(CLASSIC_STYLE.slots.source);
        expect(r.style.padding).toEqual(CLASSIC_STYLE.padding);
    });

    it("同层内 slots 覆盖 base；后一层的 base 覆盖前一层的 slots", () => {
        const r = resolveCard("child", ctx({
            parent: { schemaVersion: v, id: "parent", name: "p", style: { slots: { source: { color: "red" } } } },
            child: { schemaVersion: v, id: "child", name: "c", extends: "parent", style: { base: { color: "blue" }, slots: { text: { color: "green" } } } },
        }));
        expect(r.style.slots.text.color).toBe("green");
        expect(r.style.slots.source.color).toBe("blue");
        expect(r.style.slots.translation.color).toBe("blue");
    });

    it("多级继承按 classic → 父 → 子 的顺序合并，layout 也会继承", () => {
        const r = resolveCard("c", ctx({
            a: { schemaVersion: v, id: "a", name: "a", layout: "fancy", style: { gap: 1, radius: 1 } },
            b: { schemaVersion: v, id: "b", name: "b", extends: "a", style: { gap: 2 } },
            c: { schemaVersion: v, id: "c", name: "c", extends: "b" },
        }, ["classic", "fancy"]));
        expect(r.warnings).toEqual([]);
        expect(r.layout).toBe("fancy");
        expect(r.style.gap).toBe(2);
        expect(r.style.radius).toBe(1);
    });

    it("非法字段只回退该字段，合法字段保留", () => {
        const r = resolveCard("bad", ctx({
            bad: {
                schemaVersion: v, id: "bad", name: "bad",
                style: {
                    size: { width: 10, height: 400 },
                    gap: 12,
                    slots: { text: { fontSize: -1, fontWeight: 700, color: "red; background: url(x)", position: { x: 50, y: 150 } } },
                },
            },
        }));
        expect(r.style.size).toEqual(CLASSIC_STYLE.size);
        expect(r.style.gap).toBe(12);
        expect(r.style.slots.text.fontSize).toBe(CLASSIC_STYLE.slots.text.fontSize);
        expect(r.style.slots.text.fontWeight).toBe(700);
        expect(r.style.slots.text.color).toBe(CLASSIC_STYLE.slots.text.color);
        expect(r.style.slots.text.position).toBeNull();
        expect(r.warnings).toHaveLength(4);
    });

    it("未知字段与未知插槽记录 warning 并忽略", () => {
        const r = resolveCard("x", ctx({
            x: { schemaVersion: v, id: "x", name: "x", style: { fontSize: 20, slots: { title: { fontSize: 20 } } } },
        }));
        expect(r.style).toEqual(CLASSIC_STYLE);
        expect(r.warnings).toHaveLength(2);
    });

    it("卡片不存在、不是对象、schemaVersion 不匹配时整张回退到 classic", () => {
        for (const raw of [undefined, "oops", { schemaVersion: 99, id: "x", name: "x" }]) {
            const r = resolveCard("x", ctx({ x: raw }));
            expect(r.id).toBe("classic");
            expect(r.style).toEqual(CLASSIC_STYLE);
            expect(r.warnings.length).toBeGreaterThan(0);
        }
    });

    it("父卡片缺失时从该处直接继承 classic，自身样式保留", () => {
        const r = resolveCard("c", ctx({
            c: { schemaVersion: v, id: "c", name: "c", extends: "missing", style: { gap: 3 } },
        }));
        expect(r.id).toBe("c");
        expect(r.style.gap).toBe(3);
        expect(r.warnings.some((w) => w.includes("missing"))).toBe(true);
    });

    it("继承链存在环时不会死循环", () => {
        const r = resolveCard("a", ctx({
            a: { schemaVersion: v, id: "a", name: "a", extends: "b", style: { gap: 1 } },
            b: { schemaVersion: v, id: "b", name: "b", extends: "a", style: { gap: 2 } },
        }));
        expect(r.style.gap).toBe(1);
        expect(r.warnings.some((w) => w.includes("环"))).toBe(true);
    });

    it("继承层数超过上限时截断", () => {
        const cards: Record<string, unknown> = {};
        for (let i = 0; i < MAX_EXTENDS_DEPTH + 5; i++) {
            cards[`c${i}`] = { schemaVersion: v, id: `c${i}`, name: `c${i}`, extends: `c${i + 1}` };
        }
        const r = resolveCard("c0", ctx(cards));
        expect(r.warnings.some((w) => w.includes(String(MAX_EXTENDS_DEPTH)))).toBe(true);
    });

    it("布局不存在或为尚未实现的 template 时使用 classic 布局", () => {
        for (const layout of ["nope", "template"]) {
            const r = resolveCard("x", ctx({ x: { schemaVersion: v, id: "x", name: "x", layout } }));
            expect(r.id).toBe("x");
            expect(r.layout).toBe("classic");
            expect(r.warnings).toHaveLength(1);
        }
    });

    it("自定义字体栈末尾自动补上 classic 字体栈，且去重", () => {
        const r = resolveCard("f", ctx({
            f: { schemaVersion: v, id: "f", name: "f", style: { base: { fontFamily: ["LXGW WenKai", "Arial"] } } },
        }));
        const classicStack = CLASSIC_STYLE.slots.text.fontFamily;
        expect(r.style.slots.text.fontFamily).toEqual(["LXGW WenKai", "Arial", ...classicStack.filter((f) => f !== "Arial")]);
    });

    it("非法字体名使整个 fontFamily 字段回退", () => {
        const r = resolveCard("f", ctx({
            f: { schemaVersion: v, id: "f", name: "f", style: { base: { fontFamily: ['Evil"; }'] } } },
        }));
        expect(r.style.slots.text.fontFamily).toEqual(CLASSIC_STYLE.slots.text.fontFamily);
        expect(r.warnings).toHaveLength(1);
    });
});
