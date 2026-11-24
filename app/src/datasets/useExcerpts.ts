import { useCallback, useEffect, useRef, useState } from "react";
import type { Excerpt } from "@excerpts/schema";
import {
    deleteDataset,
    importDataset,
    listDatasets,
    randomExcerpt,
    setDatasetActive,
    type DatasetInfo,
} from "./backend.ts";

/**
 * 摘抄与数据集状态：当前显示的摘抄、已导入的数据集列表，以及导入 / 启用 / 删除操作。
 * 数据集有变化时会刷新列表并换一句，保证显示的内容来自当前启用的数据集。
 *
 * @param onError 操作失败时的回调（例如显示在浮层中）
 */
export function useExcerpts(onError: (message: string) => void) {
    const [excerpt, setExcerpt] = useState<Excerpt | null>(null);
    const [error, setError] = useState<string | null>(null);
    /** 第一次抽句完成前为 false，避免先闪一下空状态提示 */
    const [loaded, setLoaded] = useState(false);
    const [datasets, setDatasets] = useState<DatasetInfo[]>([]);

    const onErrorRef = useRef(onError);
    useEffect(() => {
        onErrorRef.current = onError;
    });

    // 只在 Promise 回调里 setState，避免在 effect 体内同步触发更新
    const next = useCallback(() => {
        randomExcerpt().then(
            (result) => {
                setExcerpt(result);
                setError(null);
                setLoaded(true);
            },
            (e: unknown) => {
                setError(String(e));
                setLoaded(true);
            },
        );
    }, []);

    const refreshList = useCallback(() => {
        listDatasets().then(setDatasets, (e: unknown) => onErrorRef.current(`读取数据集列表失败：${String(e)}`));
    }, []);

    useEffect(() => {
        next();
        refreshList();
    }, [next, refreshList]);

    const changed = useCallback(() => {
        refreshList();
        next();
    }, [next, refreshList]);

    const setActive = useCallback((id: number, active: boolean) => {
        setDatasetActive(id, active).then(changed, (e: unknown) => {
            onErrorRef.current(`切换数据集失败：${String(e)}`);
            refreshList();
        });
    }, [changed, refreshList]);

    const importNew = useCallback(() => {
        importDataset().then(
            (info) => {
                if (info) changed();
            },
            (e: unknown) => onErrorRef.current(`导入失败：${String(e)}`),
        );
    }, [changed]);

    const remove = useCallback((id: number) => {
        deleteDataset(id).then(
            (deleted) => {
                if (deleted) changed();
            },
            (e: unknown) => onErrorRef.current(`删除失败：${String(e)}`),
        );
    }, [changed]);

    return { excerpt, error, loaded, datasets, next, setActive, importNew, remove };
}

/** 没有摘抄可显示时的提示文字 */
export function emptyHint(datasets: DatasetInfo[]): string {
    if (datasets.length === 0) return "还没有数据集。右键 →「数据集」→「导入数据集…」";
    if (!datasets.some((d) => d.active)) return "没有启用的数据集。右键 →「数据集」中勾选要显示的数据集";
    return "暂无摘抄";
}
