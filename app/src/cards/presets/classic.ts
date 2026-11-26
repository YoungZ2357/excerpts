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
    padding: [28, 36],
    gap: 10,
    // 背景作用在卡片外框上，铺满整个窗口（包括四周留白）
    background: "#FBF5EA",
    radius: 0,
    // 层次靠字号和真实颜色区分，不用 opacity：半透明文字叠在米色底上会发灰
    slots: {
        text: {
            ...slotBase,
            fontSize: 28,
            fontWeight: BOLD,
            lineHeight: 1.4,
            letterSpacing: 0.02,
            color: "#2A251F",
        },
        translation: { ...slotBase, fontSize: 17, lineHeight: 1.7, color: "#7A6F62" },
        source: { ...slotBase, fontSize: 13, letterSpacing: 0.1, color: "#9A8E80", align: "right" },
        path: { ...slotBase, fontSize: 12, color: "#9A8E80", visible: false },
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
