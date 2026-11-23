import type { ComponentType } from "react";
import type { Excerpt, ResolvedCardStyle } from "@excerpts/schema";

export interface CardProps {
    excerpt: Excerpt;
    /** 解析后的完整样式；样式已通过 CSS 变量生效，需要在 JS 中读取样式的布局才用到 */
    style: ResolvedCardStyle;
    onNext?: () => void;
}

/**
 * 布局组件：只负责插槽的结构与基本排列。
 * 插槽元素需带 className="ex-slot" 与 data-slot="<SlotId>"，即可自动获得字体、排版、坐标等样式。
 */
export interface CardLayout {
    id: string;
    name: string;
    supports?: (e: Excerpt) => boolean;
    Component: ComponentType<CardProps>;
}
