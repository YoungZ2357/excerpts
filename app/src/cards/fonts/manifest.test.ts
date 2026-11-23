import { describe, expect, it } from "vitest";
import { CLASSIC_STYLE } from "../presets/classic.ts";
import { collectFontLoads, parseFontManifest } from "./manifest.ts";

const files = new Map([
    ["A-Light.woff2", "/assets/A-Light.woff2"],
    ["A-Bold.woff2", "/assets/A-Bold.woff2"],
]);

describe("parseFontManifest", () => {
    it("按清单生成字体，缺省 weight 400、style normal", () => {
        const r = parseFontManifest([
            { family: "A Serif", file: "A-Light.woff2", weight: 300 },
            { family: "A Serif", file: "A-Bold.woff2" },
        ], files);
        expect(r.warnings).toEqual([]);
        expect(r.faces).toEqual([
            { family: "A Serif", file: "A-Light.woff2", url: "/assets/A-Light.woff2", weight: 300, style: "normal" },
            { family: "A Serif", file: "A-Bold.woff2", url: "/assets/A-Bold.woff2", weight: 400, style: "normal" },
        ]);
    });

    it("没有清单也没有字体文件时什么也不做", () => {
        expect(parseFontManifest(undefined, new Map())).toEqual({ faces: [], warnings: [] });
    });

    it("有字体文件但缺少清单时提示", () => {
        const r = parseFontManifest(undefined, files);
        expect(r.faces).toEqual([]);
        expect(r.warnings).toHaveLength(1);
    });

    it("清单不是数组时全部不启用", () => {
        const r = parseFontManifest({ family: "A" }, files);
        expect(r.faces).toEqual([]);
        expect(r.warnings[0]).toContain("数组");
    });

    it("非法条目只忽略该条，未登记的文件给出提示", () => {
        const r = parseFontManifest([
            "oops",
            { family: 'Bad"Name', file: "A-Light.woff2" },
            { family: "A", file: "missing.woff2" },
            { family: "A", file: "A-Light.woff2", weight: 1500, style: "oblique" },
        ], files);
        expect(r.faces).toEqual([
            { family: "A", file: "A-Light.woff2", url: "/assets/A-Light.woff2", weight: 400, style: "normal" },
        ]);
        // oops、非法名称、文件不存在、weight 非法、style 非法、A-Bold 未登记
        expect(r.warnings).toHaveLength(6);
        expect(r.warnings[r.warnings.length - 1]).toContain("A-Bold.woff2");
    });

    it("同一家族、粗细、样式重复登记时忽略后者", () => {
        const r = parseFontManifest([
            { family: "A", file: "A-Light.woff2", weight: 300 },
            { family: "a", file: "A-Bold.woff2", weight: 300 },
        ], files);
        expect(r.faces).toHaveLength(1);
        expect(r.warnings.some((w) => w.includes("重复"))).toBe(true);
    });
});

describe("collectFontLoads", () => {
    const withText = (fontFamily: string[], visible = true) => ({
        ...CLASSIC_STYLE,
        slots: { ...CLASSIC_STYLE.slots, text: { ...CLASSIC_STYLE.slots.text, fontFamily, visible, fontWeight: 300 } },
    });

    // 以下用不在 classic 字体栈中的 "A Font" 作为打包字体，只观察 text 元素
    const bundled = new Set(["a font"]);

    it("只收集打包字体，已安装字体不需要加载，家族名不区分大小写", () => {
        expect(collectFontLoads(withText(["A Font", "KaiTi"]), bundled)).toEqual(['300 16px "A Font"']);
    });

    it("排在非打包字体之后的打包字体只是备选，不等待加载", () => {
        expect(collectFontLoads(withText(["KaiTi", "A Font"]), bundled)).toEqual([]);
    });

    it("隐藏的元素不加载字体", () => {
        expect(collectFontLoads(withText(["A Font"], false), bundled)).toEqual([]);
    });

    it("classic 等待思源宋体：原文 Bold，译文与来源 Light，隐藏的 path 不加载", () => {
        expect(collectFontLoads(CLASSIC_STYLE, new Set(["source han serif sc"]))).toEqual([
            '700 16px "Source Han Serif SC"',
            '300 16px "Source Han Serif SC"',
        ]);
    });

    it("打包字体缺失时 classic 不需要等待", () => {
        expect(collectFontLoads(CLASSIC_STYLE, new Set())).toEqual([]);
    });
});
