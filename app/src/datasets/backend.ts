import { invoke } from "@tauri-apps/api/core";
import type { Excerpt } from "@excerpts/schema";

/** Rust 侧 library.rs 中的 DatasetInfo */
export interface DatasetInfo {
    id: number;
    name: string;
    count: number;
    /** Unix 时间戳（秒） */
    importedAt: number;
    active: boolean;
}

/** 从所有启用的数据集中随机抽一条；没有可用数据时为 null */
export const randomExcerpt = () => invoke<Excerpt | null>("random_excerpt");
export const listDatasets = () => invoke<DatasetInfo[]>("list_datasets");
export const setDatasetActive = (id: number, active: boolean) =>
    invoke<void>("set_dataset_active", { id, active });
/** 弹出文件选择框并导入；用户取消时为 null */
export const importDataset = () => invoke<DatasetInfo | null>("import_dataset");
/** 弹出确认框后删除；用户取消时为 false */
export const deleteDataset = (id: number) => invoke<boolean>("delete_dataset", { id });
