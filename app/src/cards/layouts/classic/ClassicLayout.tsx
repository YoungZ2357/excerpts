import type { CardProps } from "../../types.ts";
import "./classic.css";

/**
 * 上方主体区依次放正文、译文；底栏固定在卡片底部，来源靠右下角，
 * 不随正文 / 译文的长短移动（主体区超出时裁掉，而不是把底栏挤出去）。
 */
function ClassicLayout({ excerpt, onNext }: CardProps) {
    return (
        <article className="classic-card" onClick={onNext}>
            <div className="classic-body">
                <p className="ex-slot" data-slot="text">{excerpt.text}</p>
                {excerpt.translation && (
                    <>
                        <hr className="classic-divider" />
                        <p className="ex-slot" data-slot="translation">{excerpt.translation}</p>
                    </>
                )}
            </div>
            <footer className="classic-footer">
                <p className="ex-slot" data-slot="path">{excerpt.path.join(" · ")}</p>
                <p className="ex-slot" data-slot="source">——《{excerpt.source}》</p>
            </footer>
        </article>
    );
}

export default ClassicLayout;
