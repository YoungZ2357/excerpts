import { describe, expect, it } from "vitest";
import { CLASSIC_STYLE } from "../presets/classic.ts";
import { fontFamilyCss, toCssVars } from "./cssVars.ts";

describe("toCssVars", () => {
    // 期望值从 CLASSIC_STYLE 推出，调整 classic 的设计数值时无需改测试
    it("卡片与插槽数值按单位转换为 CSS 变量", () => {
        const s = CLASSIC_STYLE;
        const vars = toCssVars(s);
        expect(vars["--ex-card-padding"]).toBe(`${s.padding[0]}px ${s.padding[1]}px`);
        expect(vars["--ex-card-background"]).toBe(s.background);
        expect(vars["--ex-text-size"]).toBe(`${s.slots.text.fontSize}px`);
        expect(vars["--ex-text-weight"]).toBe(String(s.slots.text.fontWeight));
        expect(vars["--ex-text-align"]).toBe(s.slots.text.align);
        expect(vars["--ex-translation-opacity"]).toBe(String(s.slots.translation.opacity));
        expect(vars["--ex-source-size"]).toBe(`${s.slots.source.fontSize}px`);
        expect(vars["--ex-path-display"]).toBe("none");
        expect(vars["--ex-text-position"]).toBe("static");
        expect(vars["--ex-text-width"]).toBe("auto");
        expect(vars["--ex-text-max-width"]).toBe("none");
    });

    it("坐标与竖排转换为对应的 CSS 值", () => {
        const vars = toCssVars({
            ...CLASSIC_STYLE,
            slots: {
                ...CLASSIC_STYLE.slots,
                text: { ...CLASSIC_STYLE.slots.text, writingMode: "vertical", position: { x: 50, y: 40, anchor: "center" }, maxWidth: 80 },
            },
        });
        expect(vars["--ex-text-wm"]).toBe("vertical-rl");
        expect(vars["--ex-text-position"]).toBe("absolute");
        expect(vars["--ex-text-left"]).toBe("50%");
        expect(vars["--ex-text-top"]).toBe("40%");
        expect(vars["--ex-text-transform"]).toBe("translate(-50%, -50%)");
        expect(vars["--ex-text-width"]).toBe("max-content");
        expect(vars["--ex-text-max-width"]).toBe("80%");
    });

    it("绝对定位且未设置 maxWidth 时，最大宽度为整张卡片", () => {
        const vars = toCssVars({
            ...CLASSIC_STYLE,
            slots: { ...CLASSIC_STYLE.slots, source: { ...CLASSIC_STYLE.slots.source, position: { x: 0, y: 0 } } },
        });
        expect(vars["--ex-source-max-width"]).toBe("100%");
    });

    it("字体名加引号，通用族不加", () => {
        expect(fontFamilyCss(["LXGW WenKai", "serif"])).toBe('"LXGW WenKai", serif');
    });
});
