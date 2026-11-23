import type { CardDef } from "@excerpts/schema";
import type { UserCardFile } from "./backend.ts";
import type { ResolveContext } from "./style/resolve.ts";
import { classicCard } from "./presets/classic.ts";
import { naiveCard } from "./presets/naive.ts";

/** 内置卡片，顺序即菜单中的顺序 */
export const BUILTIN_CARDS: readonly CardDef[] = [classicCard, naiveCard];

export interface CardEntry {
    id: string;
    name: string;
    builtin: boolean;
}

export interface Catalog {
    /** 菜单中可选的卡片：内置在前，用户卡片按文件名排序 */
    entries: CardEntry[];
    /** id → 原始卡片数据（内置为 CardDef，用户卡片为未校验的 JSON） */
    cards: Map<string, unknown>;
    /** 读取阶段的问题：文件读取失败、文件名不合规、与内置卡片重名等 */
    warnings: string[];
}

function displayName(raw: unknown, id: string): string {
    if (typeof raw === "object" && raw !== null && "name" in raw) {
        const name = (raw as { name: unknown }).name;
        if (typeof name === "string" && name.trim() !== "") return name.trim();
    }
    return id;
}

/** 合并内置卡片与用户卡片文件；内置卡片不允许被同名用户卡片覆盖 */
export function buildCatalog(builtins: readonly CardDef[], files: readonly UserCardFile[]): Catalog {
    const cards = new Map<string, unknown>();
    const entries: CardEntry[] = [];
    const warnings: string[] = [];

    for (const def of builtins) {
        cards.set(def.id, def);
        entries.push({ id: def.id, name: def.name, builtin: true });
    }

    for (const f of files) {
        if (f.error !== undefined || f.id === undefined) {
            warnings.push(f.file === "*" ? (f.error ?? "读取卡片目录失败") : `${f.file}：${f.error ?? "读取失败"}`);
            continue;
        }
        if (cards.has(f.id)) {
            warnings.push(`${f.file}：与内置卡片 "${f.id}" 重名，已忽略（内置卡片不可覆盖，请换一个文件名）`);
            continue;
        }
        cards.set(f.id, f.card);
        entries.push({ id: f.id, name: displayName(f.card, f.id), builtin: false });
    }

    return { entries, cards, warnings };
}

export function makeResolveContext(catalog: Catalog, hasLayout: (id: string) => boolean): ResolveContext {
    return {
        getCard: (id) => catalog.cards.get(id),
        hasLayout,
    };
}
