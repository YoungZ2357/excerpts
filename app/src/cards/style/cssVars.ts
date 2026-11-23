import { SLOT_IDS, type Anchor, type ResolvedCardStyle } from "@excerpts/schema";

const GENERIC_FAMILIES = new Set([
    "serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "math", "emoji",
    "ui-serif", "ui-sans-serif", "ui-monospace", "ui-rounded",
]);

const ANCHOR_TRANSFORM: Record<Anchor, string> = {
    "top-left": "none",
    center: "translate(-50%, -50%)",
    "bottom-right": "translate(-100%, -100%)",
};

/** 字体名加引号，通用族保持原样；名称已在 resolve 阶段校验过，不含引号等特殊字符 */
export function fontFamilyCss(stack: string[]): string {
    return stack.map((f) => (GENERIC_FAMILIES.has(f) ? f : `"${f}"`)).join(", ");
}

/**
 * 把解析后的样式展开成 CSS 变量，挂在卡片根元素上。
 * 卡片级：--ex-card-*；插槽级：--ex-<slot>-*，由 card-base.css 映射到 .ex-slot[data-slot]。
 */
export function toCssVars(style: ResolvedCardStyle): Record<string, string> {
    const vars: Record<string, string> = {
        "--ex-card-padding": `${style.padding[0]}px ${style.padding[1]}px`,
        "--ex-card-gap": `${style.gap}px`,
        "--ex-card-background": style.background,
        "--ex-card-radius": `${style.radius}px`,
    };

    for (const id of SLOT_IDS) {
        const s = style.slots[id];
        const p = `--ex-${id}-`;
        vars[`${p}font`] = fontFamilyCss(s.fontFamily);
        vars[`${p}size`] = `${s.fontSize}px`;
        vars[`${p}weight`] = String(s.fontWeight);
        vars[`${p}line-height`] = String(s.lineHeight);
        vars[`${p}letter-spacing`] = `${s.letterSpacing}em`;
        vars[`${p}color`] = s.color;
        vars[`${p}opacity`] = String(s.opacity);
        vars[`${p}align`] = s.align;
        vars[`${p}wm`] = s.writingMode === "vertical" ? "vertical-rl" : "horizontal-tb";
        vars[`${p}display`] = s.visible ? "block" : "none";
        vars[`${p}position`] = s.position ? "absolute" : "static";
        vars[`${p}left`] = s.position ? `${s.position.x}%` : "auto";
        vars[`${p}top`] = s.position ? `${s.position.y}%` : "auto";
        vars[`${p}transform`] = s.position ? ANCHOR_TRANSFORM[s.position.anchor ?? "top-left"] : "none";
        // 绝对定位的元素按内容收缩宽度，若不显式设置 width，left: 50% 时最多只能占到卡片一半宽
        vars[`${p}width`] = s.position ? "max-content" : "auto";
        vars[`${p}max-width`] = s.maxWidth !== null ? `${s.maxWidth}%` : s.position ? "100%" : "none";
    }

    return vars;
}
