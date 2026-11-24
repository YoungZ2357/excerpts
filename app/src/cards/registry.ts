import type { CardLayout } from "./types.ts";
import { classicLayout } from "./layouts/classic/index.ts";
import { verticalLayout } from "./layouts/vertical/index.ts";

const layouts: CardLayout[] = [classicLayout, verticalLayout];

export function getLayout(id: string): CardLayout {
    return layouts.find((l) => l.id === id) ?? classicLayout;
}

export function hasLayout(id: string): boolean {
    return layouts.some((l) => l.id === id);
}
