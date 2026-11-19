import type { CardLayout } from "../types.ts";
import ClassicCard from "./ClassicCard.tsx";

export const classicLayout: CardLayout = {
    id: "classic",
    name: "经典",
    Component: ClassicCard,
};
