import type { CardProps } from "../../types.ts";
import "./vertical.css";

/**
 * 竖排布局：上半部分原文竖排、从右往左成列，出处做成印章放在左上角；
 * 虚线下方是横排译文，章节（path 的最后一级）固定在右下角。
 */
/** 句末标点处另起一列，并去掉句末标点（仿古籍竖排）；句中的逗号等保留 */
function splitSentences(text: string): string[] {
    return text
        .split(/[。！？；!?;]+/)
        .map((s) => s.trim())
        .filter((s) => s !== "");
}

function VerticalLayout({ excerpt, onNext }: CardProps) {
    const chapter = excerpt.path[excerpt.path.length - 1] ?? "";
    const sentences = splitSentences(excerpt.text);
    return (
        <article className="vertical-card" onClick={onNext}>
            <div className="vertical-top">
                <p className="ex-slot" data-slot="source">{excerpt.source}</p>
                <p className="ex-slot" data-slot="text">
                    {sentences.map((s, i) => (
                        <span key={i} className="vertical-sentence">{s}</span>
                    ))}
                </p>
            </div>
            {excerpt.translation && (
                <>
                    <hr className="vertical-divider" />
                    <p className="ex-slot" data-slot="translation">{excerpt.translation}</p>
                </>
            )}
            <footer className="vertical-footer">
                <p className="ex-slot" data-slot="path">{chapter}</p>
            </footer>
        </article>
    );
}

export default VerticalLayout;
