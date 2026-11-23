import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Excerpt } from "@excerpts/schema";
import CardFrame from "./cards/CardFrame";
import IssuesOverlay from "./cards/IssuesOverlay";
import { openCardsDir } from "./cards/backend";
import { useCardContextMenu } from "./cards/useCardContextMenu";
import { useCardStore } from "./cards/useCardStore";
import { useCardWindowSize } from "./cards/useCardWindowSize";

function App() {
    const [excerpt, setExcerpt] = useState<Excerpt | null>(null);
    const [error, setError] = useState<string | null>(null);
    /** 浮层中显示的内容：卡片问题，或菜单操作失败的原因；null 表示不显示 */
    const [overlay, setOverlay] = useState<string[] | null>(null);
    const store = useCardStore();
    const { card, Layout } = store;
    useCardWindowSize(card.style.size, store.ready);

    const onContextMenu = useCardContextMenu({
        entries: store.entries,
        currentId: store.currentId,
        issueCount: store.issues.length,
        onSelect: store.select,
        onShowIssues: () => setOverlay(store.issues),
        onReload: store.reload,
        onOpenDir: () => {
            openCardsDir().catch((e: unknown) => setOverlay([`打开卡片文件夹失败：${String(e)}`]));
        },
    });

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

    // 设置与用户卡片加载完成前不渲染卡片，避免先显示 classic 再跳到选中的卡片
    if (!store.ready) return null;

    return (
        <CardFrame style={card.style} onContextMenu={onContextMenu}>
            {error ? (
                <p style={{ color: "red" }}>{error}</p>
            ) : excerpt ? (
                <Layout excerpt={excerpt} style={card.style} onNext={next} />
            ) : (
                <p>暂无摘抄</p>
            )}
            {overlay && <IssuesOverlay issues={overlay} onClose={() => setOverlay(null)} />}
        </CardFrame>
    );
}

export default App;
