import { invoke } from "@tauri-apps/api/core";

/** Rust 侧 list_user_cards 返回的单个文件结果：成功时有 id 与 card，失败时有 error */
export interface UserCardFile {
    file: string;
    id?: string;
    card?: unknown;
    error?: string;
}

export interface Settings {
    schemaVersion: 1;
    currentCard: string;
}

export const DEFAULT_SETTINGS: Settings = { schemaVersion: 1, currentCard: "classic" };

export const listUserCards = () => invoke<UserCardFile[]>("list_user_cards");
export const getSettings = () => invoke<Settings>("get_settings");
export const setSettings = (settings: Settings) => invoke<void>("set_settings", { settings });
export const openCardsDir = () => invoke<void>("open_cards_dir");
