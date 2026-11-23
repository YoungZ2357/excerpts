import { useCallback, useEffect, useRef, type MouseEvent } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { Menu } from "@tauri-apps/api/menu";
import type { CardEntry } from "./catalog.ts";

interface ContextMenuOptions {
    entries: CardEntry[];
    currentId: string;
    issueCount: number;
    onSelect: (id: string) => void;
    onShowIssues: () => void;
    onReload: () => void;
    onOpenDir: () => void;
}

/** 右键弹出原生菜单：卡片列表、问题提示、重新加载、打开卡片文件夹 */
export function useCardContextMenu(options: ContextMenuOptions) {
    // 用 ref 保存最新的选项，使返回的事件处理函数保持稳定
    const optionsRef = useRef(options);
    useEffect(() => {
        optionsRef.current = options;
    });

    // 上一次弹出的菜单；再次弹出前释放，避免菜单资源累积
    const lastMenu = useRef<Menu | null>(null);
    useEffect(() => () => {
        void lastMenu.current?.close();
    }, []);

    return useCallback((event: MouseEvent) => {
        event.preventDefault();
        if (!isTauri()) return;
        const o = optionsRef.current;

        // 注意：菜单项不要指定 id。Tauri 按菜单项 id 全局登记点击回调，旧菜单释放时会按 id 删除回调；
        // 若每次弹出都用相同的 id，释放上一次的菜单会把这一次菜单的回调一起删掉，导致点击无反应。
        // 不指定 id 时由 Tauri 生成唯一 id，就不会互相影响。
        const items = [
            ...o.entries.map((e) => ({
                text: e.name,
                checked: e.id === o.currentId,
                action: () => o.onSelect(e.id),
            })),
            { item: "Separator" as const },
            ...(o.issueCount > 0
                ? [{ text: `⚠ 有 ${o.issueCount} 个卡片问题…`, action: o.onShowIssues }]
                : []),
            { text: "重新加载卡片", action: o.onReload },
            { text: "打开卡片文件夹", action: o.onOpenDir },
        ];

        Menu.new({ items })
            .then(async (menu) => {
                await lastMenu.current?.close();
                lastMenu.current = menu;
                await menu.popup();
            })
            .catch((e: unknown) => console.warn("[card] 弹出菜单失败", e));
    }, []);
}
