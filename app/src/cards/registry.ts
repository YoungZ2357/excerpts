import type { CardDef } from "@excerpts/schema";
import type { CardLayout } from "./types.ts";
import type { ResolveContext } from "./style/resolve.ts";
import { classicLayout } from "./layouts/classic/index.ts";
import { classicCard } from "./presets/classic.ts";

const layouts: CardLayout[] = [classicLayout];

/** 内置卡片；阶段 2 起还会合并 appConfigDir/cards/*.json 中的用户卡片 */
const builtinCards: CardDef[] = [classicCard];

export function getLayout(id: string): CardLayout {
    return layouts.find((l) => l.id === id) ?? classicLayout;
}

export function listCards(): readonly CardDef[] {
    return builtinCards;
}

export const registryContext: ResolveContext = {
    getCard: (id) => builtinCards.find((c) => c.id === id),
    hasLayout: (id) => layouts.some((l) => l.id === id),
};
