import { describe, expect, it } from "vitest";
import { NOTICES } from "./notices.ts";

describe("第三方许可", () => {
    it("每一项都带有版权声明与许可证全文", () => {
        for (const n of NOTICES) {
            expect(n.text).toContain(n.copyright);
            expect(n.text.length).toBeGreaterThan(1000);
        }
    });

    it("思源宋体附带完整的 OFL 1.1 文本", () => {
        const font = NOTICES.find((n) => n.name.includes("Source Han Serif"))!;
        expect(font.text).toContain("SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007");
        expect(font.text).toContain("Reserved Font Name 'Source'");
        expect(font.text).toContain("OTHER DEALINGS IN THE FONT SOFTWARE.");
    });
});
