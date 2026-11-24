import { CARD_SCHEMA_VERSION, type CardDef, type ResolvedCardStyle, type ResolvedSlotStyle } from "@excerpts/schema";

/**
 * 首选打包字体思源宋体（assets/fonts，见 fonts.json：Light = 300，Bold = 700）；
 * 打包字体缺失时（如新 clone 的仓库）退回系统中常见的宋体 / 衬线字体。
 */
const FONT_STACK = ["Source Han Serif SC", "Noto Serif SC", "Songti SC", "SimSun", "serif"];

const LIGHT = 300;
const BOLD = 700;

const slotBase: ResolvedSlotStyle = {
    fontFamily: FONT_STACK,
    fontSize: 20,
    fontWeight: LIGHT,
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
    size: { width: 500, height: 280 },
    padding: [16, 20],
    gap: 8,
    // 背景作用在卡片外框上，铺满整个窗口（包括四周留白）
    background: "#FEF6E5",
    radius: 0,
    slots: {
        text: { ...slotBase, fontSize: 28, fontWeight: BOLD, lineHeight: 1.2, align: "left" },
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
