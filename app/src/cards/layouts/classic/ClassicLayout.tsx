import type { Excerpt } from "@excerpts/schema";
import type { CardProps } from "../../types.ts";
import "./classic.css";

/** 「《书名 · 章节》」：章节取 path 的最后一级，与书名相同（如只有一级目录）时省略 */
function formatSource({ source, path }: Excerpt): string {
    const chapter = path[path.length - 1];
    return chapter && chapter !== source ? `《${source} · ${chapter}》` : `《${source}》`;
}

/**
 * 主体区放正文、分隔线、译文，整体在主体区内垂直居中（略偏上）；
 * 底栏固定在卡片底部，来源靠右下角，不随正文 / 译文的长短移动（主体区超出时裁掉，而不是把底栏挤出去）。
 */
function ClassicLayout({ excerpt, onNext }: CardProps) {
    return (
        <article className="classic-card" onClick={onNext}>
            <div className="classic-body">
                <div className="classic-content">
                    <p className="ex-slot" data-slot="text">{excerpt.text}</p>
                    {excerpt.translation && (
                        <>
                            <hr className="classic-divider" />
                            <p className="ex-slot" data-slot="translation">{excerpt.translation}</p>
                        </>
                    )}
                </div>
            </div>
            <footer className="classic-footer">
                <p className="ex-slot" data-slot="path">{excerpt.path.join(" · ")}</p>
                <p className="ex-slot" data-slot="source">{formatSource(excerpt)}</p>
            </footer>
        </article>
    );
}

export default ClassicLayout;
