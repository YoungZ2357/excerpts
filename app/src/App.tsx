import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Excerpt } from "@excerpts/schema";
import CardFrame from "./cards/CardFrame";
import { useCard } from "./cards/useCard";
import { useCardWindowSize } from "./cards/useCardWindowSize";

// 阶段 2 改为从 settings.json 读取当前选中的卡片
const CURRENT_CARD_ID = "classic";

function App() {
    const [excerpt, setExcerpt] = useState<Excerpt | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { card, Layout } = useCard(CURRENT_CARD_ID);
    useCardWindowSize(card.style.size);

    // 只在 Promise 回调里 setState，避免在 effect 体内同步触发更新
    function load(isActive: () => boolean = () => true) {
        invoke<Excerpt | null>("random_excerpt").then(
            (result) => {
                if (!isActive()) return;
                setExcerpt(result);
                setError(null);
            },
            (e: unknown) => {
                if (isActive()) setError(String(e));
            },
        );
    }

    const next = () => load();

    useEffect(() => {
        let active = true;
        load(() => active);
        return () => { active = false; };
    }, []);

    return (
        <CardFrame style={card.style}>
            {error ? (
                <p style={{ color: "red" }}>{error}</p>
            ) : excerpt ? (
                <Layout excerpt={excerpt} style={card.style} onNext={next} />
            ) : (
                <p>暂无摘抄</p>
            )}
        </CardFrame>
    );
}

export default App;
