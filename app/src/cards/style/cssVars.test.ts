import { describe, expect, it } from "vitest";
import { CLASSIC_STYLE } from "../presets/classic.ts";
import { fontFamilyCss, toCssVars } from "./cssVars.ts";

describe("toCssVars", () => {
    it("classic 生成的变量与原 classic.css 的效果一致", () => {
        const vars = toCssVars(CLASSIC_STYLE);
        expect(vars["--ex-card-padding"]).toBe("16px 20px");
        expect(vars["--ex-text-size"]).toBe("20px");
        expect(vars["--ex-translation-opacity"]).toBe("0.75");
        expect(vars["--ex-source-align"]).toBe("right");
        expect(vars["--ex-source-size"]).toBe("14px");
        expect(vars["--ex-path-display"]).toBe("none");
        expect(vars["--ex-text-position"]).toBe("static");
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
        expect(vars["--ex-text-max-width"]).toBe("80%");
    });

    it("字体名加引号，通用族不加", () => {
        expect(fontFamilyCss(["LXGW WenKai", "serif"])).toBe('"LXGW WenKai", serif');
    });
});
