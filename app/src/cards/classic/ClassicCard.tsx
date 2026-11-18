import type { CardLayout, CardProps } from "../types.ts";
import "./classic.css"

function ClassicCard({ excerpt, onNext }: CardProps) {
    return (
        <article className={"classic-card"} onClick={onNext}>
            <p className={"classic-text"}>{excerpt.text}</p>
            {excerpt.translation &&(
                <p className={"classic-translation"}>{excerpt.translation}</p>
            )}
            <footer className={"classic-source"}>--{excerpt.source}</footer>
        </article>
);
}

export const classicLayout: CardLayout = {
    id: "classic",
    name: "经典",
    Component: ClassicCard,
};