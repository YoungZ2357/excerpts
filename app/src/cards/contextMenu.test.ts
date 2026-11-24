import { describe, expect, it, vi } from "vitest";
import type { DatasetInfo } from "../datasets/backend.ts";
import { emptyHint } from "../datasets/useExcerpts.ts";
import { buildContextMenuItems, type ContextMenuOptions } from "./useCardContextMenu.ts";

const ds = (id: number, name: string, active: boolean, count = 3): DatasetInfo =>
    ({ id, name, active, count, importedAt: 0 });

function options(datasets: DatasetInfo[]): ContextMenuOptions {
    return {
        entries: [{ id: "classic", name: "经典", builtin: true }],
        currentId: "classic",
        issueCount: 0,
        datasets,
        onSelect: vi.fn(),
        onShowIssues: vi.fn(),
        onReload: vi.fn(),
        onOpenDir: vi.fn(),
        onToggleDataset: vi.fn(),
        onImportDataset: vi.fn(),
        onDeleteDataset: vi.fn(),
        onShowAbout: vi.fn(),
    };
}

type Item = { text?: string; checked?: boolean; items?: Item[]; action?: () => void };

function datasetMenu(o: ContextMenuOptions): Item[] {
    const sub = (buildContextMenuItems(o) as Item[]).find((i) => i.text === "数据集");
    expect(sub?.items).toBeDefined();
    return sub!.items!;
}

describe("buildContextMenuItems / 数据集子菜单", () => {
    it("没有数据集时只有导入项", () => {
        const o = options([]);
        const items = datasetMenu(o);
        expect(items.map((i) => i.text)).toEqual(["导入数据集…"]);
        items[0].action!();
        expect(o.onImportDataset).toHaveBeenCalled();
    });

    it("列出数据集及勾选状态，点击切换启用", () => {
        const o = options([ds(1, "示例", true), ds(4, "史记", false, 12345)]);
        const items = datasetMenu(o);
        expect(items.slice(0, 2).map((i) => [i.text, i.checked])).toEqual([
            ["示例（3 条）", true],
            [`史记（${(12345).toLocaleString()} 条）`, false],
        ]);
        items[0].action!();
        items[1].action!();
        expect(o.onToggleDataset).toHaveBeenNthCalledWith(1, 1, false);
        expect(o.onToggleDataset).toHaveBeenNthCalledWith(2, 4, true);
    });

    it("删除子菜单按 id 删除对应数据集", () => {
        const o = options([ds(1, "示例", true), ds(4, "史记", false)]);
        const del = datasetMenu(o).find((i) => i.text === "删除数据集")!;
        expect(del.items!.map((i) => i.text)).toEqual(["示例", "史记"]);
        del.items![1].action!();
        expect(o.onDeleteDataset).toHaveBeenCalledWith(4);
    });
});

describe("buildContextMenuItems / 关于与许可", () => {
    it("最后一项打开关于与许可", () => {
        const o = options([]);
        const items = buildContextMenuItems(o) as Item[];
        const last = items[items.length - 1];
        expect(last.text).toBe("关于与许可…");
        last.action!();
        expect(o.onShowAbout).toHaveBeenCalled();
    });
});

describe("emptyHint", () => {
    it("区分没有数据集与没有启用的数据集", () => {
        expect(emptyHint([])).toContain("导入数据集");
        expect(emptyHint([ds(1, "a", false)])).toContain("勾选");
    });
});
