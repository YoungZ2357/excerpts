import type { ComponentType } from "react";
import type { Excerpt } from "@excerpts/schema"

export interface CardProps {
    excerpt: Excerpt;
    onNext?: () => void;
}

export interface CardLayout {
    id: string;
    name: string;
    supports?: (e: Excerpt) => boolean;
    Component: ComponentType<CardProps>
}