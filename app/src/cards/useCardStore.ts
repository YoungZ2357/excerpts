import { useCallback, useEffect, useMemo, useState } from "react";
import {
    DEFAULT_SETTINGS,
    getSettings,
    listUserCards,
    setSettings,
    type Settings,
    type UserCardFile,
} from "./backend.ts";
import { BUILTIN_CARDS, buildCatalog, makeResolveContext, type Catalog } from "./catalog.ts";
import { registerBundledFonts, waitForCardFonts } from "./fonts/bundled.ts";
import { getLayout, hasLayout } from "./registry.ts";
import { resolveCard, type ResolvedCard } from "./style/resolve.ts";

/** 启动时等待设置与用户卡片的最长时间，超时先用 classic 显示 */
const STARTUP_TIMEOUT_MS = 1000;

const FALLBACK_CATALOG = buildCatalog(BUILTIN_CARDS, []);

async function loadUserFiles(): Promise<UserCardFile[]> {
    try {
        return await listUserCards();
    } catch (e) {
        return [{ file: "*", error: `读取用户卡片失败：${String(e)}` }];
    }
}

async function loadSettings(): Promise<Settings> {
    try {
        return await getSettings();
    } catch (e) {
        console.warn("[card] 读取设置失败，使用默认设置", e);
        return DEFAULT_SETTINGS;
    }
}

/**
 * 卡片状态：内置 + 用户卡片目录、当前选中的卡片及其解析结果。
 * ready 之前不应渲染卡片或调整窗口，避免先显示 classic 再跳到用户卡片。
 *
 * 切换卡片时，先等新卡片用到的打包字体加载完，再把它换成正在显示的卡片（shown），
 * 期间继续显示上一张卡片，避免文字先用默认字体显示再跳成新字体。
 */
export function useCardStore() {
    const [catalog, setCatalog] = useState<Catalog | null>(null);
    const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
    const [fontWarnings] = useState(() => registerBundledFonts().warnings);
    const [shown, setShown] = useState<ResolvedCard | null>(null);

    useEffect(() => {
        let active = true;
        const timer = setTimeout(() => {
            if (active) setCatalog((c) => c ?? FALLBACK_CATALOG);
        }, STARTUP_TIMEOUT_MS);

        Promise.all([loadUserFiles(), loadSettings()]).then(([files, s]) => {
            if (!active) return;
            clearTimeout(timer);
            setCatalog(buildCatalog(BUILTIN_CARDS, files));
            setSettingsState(s);
        });

        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, []);

    const effectiveCatalog = catalog ?? FALLBACK_CATALOG;

    const card = useMemo(
        () => resolveCard(settings.currentCard, makeResolveContext(effectiveCatalog, hasLayout)),
        [settings.currentCard, effectiveCatalog],
    );

    useEffect(() => {
        if (catalog === null) return;
        let active = true;
        waitForCardFonts(card.style).then(() => {
            if (active) setShown(card);
        });
        return () => {
            active = false;
        };
    }, [catalog, card]);

    /** 打包字体清单的问题 + 读取阶段的问题 + 当前卡片解析时的问题 */
    const issues = useMemo(
        () => [...fontWarnings, ...effectiveCatalog.warnings, ...card.warnings],
        [fontWarnings, effectiveCatalog, card],
    );

    useEffect(() => {
        for (const w of issues) console.warn(`[card] ${w}`);
    }, [issues]);

    const select = useCallback((id: string) => {
        const next: Settings = { ...settings, currentCard: id };
        setSettingsState(next);
        setSettings(next).catch((e: unknown) => console.warn("[card] 保存设置失败", e));
    }, [settings]);

    const reload = useCallback(() => {
        loadUserFiles().then((files) => setCatalog(buildCatalog(BUILTIN_CARDS, files)));
    }, []);

    const displayed = shown ?? card;

    return {
        ready: shown !== null,
        entries: effectiveCatalog.entries,
        currentId: card.id,
        /** 正在显示的卡片（字体已就绪）；切换过程中仍是上一张 */
        card: displayed,
        Layout: getLayout(displayed.layout).Component,
        issues,
        select,
        reload,
    };
}
