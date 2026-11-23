/**
 * 卡片定义（CardDef）相关类型。
 *
 * 卡片 = 布局组件（代码） + 样式数据（本文件描述的结构）。
 * 内置卡片（如 classic）与用户卡片使用同一套结构；用户卡片只需写出与父卡片的差异。
 */

export const CARD_SCHEMA_VERSION = 1;

/** 布局中可被单独设置样式的元素 */
export const SLOT_IDS = ["text", "translation", "source", "path"] as const;
export type SlotId = (typeof SLOT_IDS)[number];

export type TextAlign = "left" | "center" | "right" | "justify";
export type WritingMode = "horizontal" | "vertical";
export type Anchor = "top-left" | "center" | "bottom-right";

export interface TextStyle {
    /** 字体栈，如 ["LXGW WenKai", "Songti SC", "serif"]；解析时会自动在末尾补上 classic 的字体栈 */
    fontFamily?: string[];
    /** px */
    fontSize?: number;
    fontWeight?: number;
    /** 行高倍数 */
    lineHeight?: number;
    /** em */
    letterSpacing?: number;
    /** 任意 CSS 颜色，"inherit" 表示跟随系统明暗主题 */
    color?: string;
    /** 0 ~ 1 */
    opacity?: number;
    align?: TextAlign;
    writingMode?: WritingMode;
    visible?: boolean;
}

export interface SlotPosition {
    /** 卡片宽度的百分比，0 ~ 100 */
    x: number;
    /** 卡片高度的百分比，0 ~ 100 */
    y: number;
    /** 坐标点对应元素的哪个位置，默认 top-left */
    anchor?: Anchor;
}

export interface SlotStyle extends TextStyle {
    /** 不设置时按布局的流式排列；设置后改为绝对定位 */
    position?: SlotPosition;
    /** 卡片宽度的百分比 */
    maxWidth?: number;
}

export interface CardSize {
    /** 逻辑像素，同时决定窗口大小 */
    width: number;
    height: number;
}

export interface CardStyle {
    size?: CardSize;
    /** [上下, 左右]，px */
    padding?: [number, number];
    /** 流式排列时元素之间的间距，px */
    gap?: number;
    background?: string;
    /** 圆角，px */
    radius?: number;
    /** 所有插槽共用的默认值 */
    base?: TextStyle;
    slots?: Partial<Record<SlotId, SlotStyle>>;
}

/** 预留：mustache 自定义 HTML 模板，仅在 layout === "template" 时生效，当前版本不解析 */
export interface CardTemplate {
    html: string;
    css?: string;
}

export interface CardDef {
    schemaVersion: typeof CARD_SCHEMA_VERSION;
    id: string;
    name: string;
    /** 布局组件 id，默认 "classic" */
    layout?: string;
    /** 父卡片 id，默认 "classic" */
    extends?: string;
    style?: CardStyle;
    template?: CardTemplate;
}

/* ---------- 解析后的完整样式：每个字段都有值 ---------- */

export type ResolvedTextStyle = Required<TextStyle>;

export interface ResolvedSlotStyle extends ResolvedTextStyle {
    position: SlotPosition | null;
    maxWidth: number | null;
}

export interface ResolvedCardStyle {
    size: CardSize;
    padding: [number, number];
    gap: number;
    background: string;
    radius: number;
    slots: Record<SlotId, ResolvedSlotStyle>;
}
