import { CARD_SCHEMA_VERSION, type CardDef, type ResolvedCardStyle, type ResolvedSlotStyle } from "@excerpts/schema";

const FONT_STACK = ["Inter", "Avenir", "Helvetica", "Arial", "sans-serif"];

const slotBase: ResolvedSlotStyle = {
    fontFamily: FONT_STACK,
    fontSize: 16,
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: 0,
    color: "inherit",
    opacity: 1,
    align: "left",
    writingMode: "horizontal",
    visible: true,
    position: null,
    maxWidth: null,
};

/**
 * classic 根样板：所有卡片解析的起点，也是任何字段缺失或非法时的最终兜底。
 * 类型为 ResolvedCardStyle，编译期保证每个字段都有值。
 */
export const CLASSIC_STYLE: ResolvedCardStyle = {
    size: { width: 400, height: 300 },
    padding: [16, 20],
    gap: 8,
    background: "transparent",
    radius: 0,
    slots: {
        text: { ...slotBase, fontSize: 20, lineHeight: 1.2 },
        translation: { ...slotBase, opacity: 0.75 },
        source: { ...slotBase, fontSize: 14, opacity: 0.6, align: "right" },
        path: { ...slotBase, fontSize: 12, opacity: 0.5, visible: false },
    },
};

export const CLASSIC_ID = "classic";

export const classicCard: CardDef = {
    schemaVersion: CARD_SCHEMA_VERSION,
    id: CLASSIC_ID,
    name: "经典",
    layout: "classic",
    // 不写 style：classic 的样式就是解析起点 CLASSIC_STYLE 本身
};
