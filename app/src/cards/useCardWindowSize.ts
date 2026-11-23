import { useEffect } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import type { CardSize } from "@excerpts/schema";

/** 让窗口尺寸跟随卡片的 size（逻辑像素），并限制在屏幕可用范围内；enabled 为 false 时不调整 */
export function useCardWindowSize({ width, height }: CardSize, enabled = true) {
    useEffect(() => {
        if (!enabled || !isTauri()) return;
        const w = Math.min(width, window.screen.availWidth);
        const h = Math.min(height, window.screen.availHeight);
        getCurrentWindow()
            .setSize(new LogicalSize(w, h))
            .catch((e: unknown) => console.warn("[card] 调整窗口大小失败", e));
    }, [width, height, enabled]);
}
