import type { CardLayout } from "./types.ts";
import { classicLayout } from "./classic/index.ts";

const layouts: CardLayout[] = [classicLayout];

export function getLayout(id: string): CardLayout {
    return layouts.find((l) => l.id === id) ?? classicLayout;
}
