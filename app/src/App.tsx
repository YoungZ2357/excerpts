import { useState } from "react";
import AboutOverlay from "./about/AboutOverlay";
import CardFrame from "./cards/CardFrame";
import IssuesOverlay from "./cards/IssuesOverlay";
import { openCardsDir } from "./cards/backend";
import { useCardContextMenu } from "./cards/useCardContextMenu";
import { useCardStore } from "./cards/useCardStore";
import { useCardWindowSize } from "./cards/useCardWindowSize";
import { emptyHint, useExcerpts } from "./datasets/useExcerpts";

interface Overlay {
    title: string;
    issues: string[];
}

function App() {
    /** 浮层中显示的内容：卡片问题，或操作失败的原因；null 表示不显示 */
    const [overlay, setOverlay] = useState<Overlay | null>(null);
    const [aboutOpen, setAboutOpen] = useState(false);
    const showError = (message: string) => setOverlay({ title: "操作失败", issues: [message] });

    const store = useCardStore();
    const { card, Layout } = store;
    useCardWindowSize(card.style.size, store.ready);
    const data = useExcerpts(showError);

    const onContextMenu = useCardContextMenu({
        entries: store.entries,
        currentId: store.currentId,
        issueCount: store.issues.length,
        datasets: data.datasets,
        onSelect: store.select,
        onShowIssues: () => setOverlay({ title: "卡片问题", issues: store.issues }),
        onReload: store.reload,
        onOpenDir: () => {
            openCardsDir().catch((e: unknown) => showError(`打开卡片文件夹失败：${String(e)}`));
        },
        onToggleDataset: data.setActive,
        onImportDataset: data.importNew,
        onDeleteDataset: data.remove,
        onShowAbout: () => setAboutOpen(true),
    });

    // 设置与用户卡片加载完成前不渲染卡片，避免先显示 classic 再跳到选中的卡片
    if (!store.ready || !data.loaded) return null;

    return (
        <CardFrame style={card.style} onContextMenu={onContextMenu}>
            {data.error ? (
                <p style={{ color: "red" }}>{data.error}</p>
            ) : data.excerpt ? (
                <Layout excerpt={data.excerpt} style={card.style} onNext={data.next} />
            ) : (
                <p>{emptyHint(data.datasets)}</p>
            )}
            {aboutOpen && <AboutOverlay onClose={() => setAboutOpen(false)} />}
            {overlay && (
                <IssuesOverlay title={overlay.title} issues={overlay.issues} onClose={() => setOverlay(null)} />
            )}
        </CardFrame>
    );
}

export default App;
