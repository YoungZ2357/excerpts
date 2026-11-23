import type { CardProps } from "../../types.ts";
import "./classic.css";

function ClassicLayout({ excerpt, onNext }: CardProps) {
    return (
        <article className="classic-card" onClick={onNext}>
            <p className="ex-slot" data-slot="text">{excerpt.text}</p>
            {excerpt.translation && (
                <p className="ex-slot" data-slot="translation">{excerpt.translation}</p>
            )}
            <footer className="ex-slot" data-slot="source">——《{excerpt.source}》</footer>
            <p className="ex-slot" data-slot="path">{excerpt.path.join(" · ")}</p>
        </article>
    );
}

export default ClassicLayout;
