import { useEffect, useMemo } from "react";
import { getLayout, registryContext } from "./registry.ts";
import { resolveCard } from "./style/resolve.ts";

/** 解析指定卡片，返回解析结果与对应的布局组件；解析中的回退信息输出到控制台 */
export function useCard(cardId: string) {
    const card = useMemo(() => resolveCard(cardId, registryContext), [cardId]);

    useEffect(() => {
        for (const w of card.warnings) console.warn(`[card] ${w}`);
    }, [card]);

    return { card, Layout: getLayout(card.layout).Component };
}
