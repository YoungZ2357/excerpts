import { useMemo, type CSSProperties, type MouseEventHandler, type ReactNode } from "react";
import type { ResolvedCardStyle } from "@excerpts/schema";
import { toCssVars } from "./style/cssVars.ts";
import "./style/card-base.css";

interface CardFrameProps {
    style: ResolvedCardStyle;
    onContextMenu?: MouseEventHandler;
    children: ReactNode;
}

/** 卡片外框：铺满窗口，并把解析后的样式以 CSS 变量的形式提供给内部布局 */
function CardFrame({ style, onContextMenu, children }: CardFrameProps) {
    const vars = useMemo(() => toCssVars(style) as CSSProperties, [style]);
    return <div className="ex-card" style={vars} onContextMenu={onContextMenu}>{children}</div>;
}

export default CardFrame;
