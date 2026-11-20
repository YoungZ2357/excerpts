import {
    CARD_SCHEMA_VERSION,
    SLOT_IDS,
    type CardDef,
    type CardStyle,
    type ResolvedCardStyle,
    type ResolvedSlotStyle,
    type SlotId,
    type SlotPosition,
    type SlotStyle,
    type TextStyle,
} from "@excerpts/schema";
import { CLASSIC_ID, CLASSIC_STYLE, classicCard } from "../presets/classic.ts";

/**
 * 卡片解析：把一张卡片（及其 extends 链）合并成每个字段都有值的 ResolvedCardStyle。
 *
 * 合并顺序：CLASSIC_STYLE → 最远的父卡片 → …… → 当前卡片。
 * 同一层内，slots[x] 覆盖 base；后一层的 base 覆盖前一层的 slots[x]。
 *
 * 回退规则：
 * - 字段级：单个字段非法时只丢弃该字段，沿用上一层的值，并记录 warning；
 * - 卡片级：卡片不存在、不是对象、schemaVersion 不匹配时，整张卡片回退到 classic；
 * - 继承链：父卡片不存在、出现环、超过最大层数时，从该处起直接继承 classic；
 * - 布局：布局不存在（包括尚未实现的 "template"）时使用 classic 布局。
 */

export const MAX_EXTENDS_DEPTH = 8;
export const TEMPLATE_LAYOUT_ID = "template";

export const LIMITS = {
    width: [200, 7680],
    height: [120, 4320],
    fontSize: [6, 400],
    fontWeight: [1, 1000],
    lineHeight: [0.5, 5],
    letterSpacing: [-1, 5],
    padding: [0, 400],
    gap: [0, 400],
    radius: [0, 1000],
    percent: [0, 100],
} as const;

export interface ResolveContext {
    /** 返回原始卡片数据（用户卡片来自 JSON，类型未知） */
    getCard(id: string): unknown;
    hasLayout(id: string): boolean;
}

export interface ResolvedCard {
    /** 实际使用的卡片 id（卡片级回退后为 classic） */
    id: string;
    name: string;
    layout: string;
    style: ResolvedCardStyle;
    warnings: string[];
}

type Warn = (message: string) => void;
/** 合法时返回（可能经过规范化的）值，非法时返回 undefined */
type Check<T> = (value: unknown) => T | undefined;

/* ---------------- 基础校验 ---------------- */

const isObject = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);

const numIn = (range: readonly [number, number]): Check<number> => (v) =>
    typeof v === "number" && Number.isFinite(v) && v >= range[0] && v <= range[1] ? v : undefined;

const oneOf = <T extends string>(...values: T[]): Check<T> => (v) =>
    values.includes(v as T) ? (v as T) : undefined;

const bool: Check<boolean> = (v) => (typeof v === "boolean" ? v : undefined);

const UNSAFE_CSS = /[;{}<>\\]|url\(|expression\(/i;

/** 可直接写入 CSS 变量的值；浏览器中再用 CSS.supports 做一次语法检查 */
const cssValue = (property: string): Check<string> => (v) => {
    if (typeof v !== "string" || v.trim() === "" || v.length > 200 || UNSAFE_CSS.test(v)) return undefined;
    const css = (globalThis as { CSS?: { supports?: (p: string, v: string) => boolean } }).CSS;
    if (css?.supports && !css.supports(property, v)) return undefined;
    return v.trim();
};

const FONT_NAME = /^[^"\\;{}<>]{1,64}$/;

const fontFamily: Check<string[]> = (v) => {
    if (!Array.isArray(v) || v.length === 0 || v.length > 16) return undefined;
    const names = v.map((n) => (typeof n === "string" ? n.trim() : ""));
    return names.every((n) => n !== "" && FONT_NAME.test(n)) ? names : undefined;
};

const position: Check<SlotPosition> = (v) => {
    if (!isObject(v)) return undefined;
    const x = numIn(LIMITS.percent)(v.x);
    const y = numIn(LIMITS.percent)(v.y);
    if (x === undefined || y === undefined) return undefined;
    if (v.anchor === undefined) return { x, y };
    const anchor = oneOf("top-left", "center", "bottom-right")(v.anchor);
    return anchor === undefined ? undefined : { x, y, anchor };
};

const size: Check<{ width: number; height: number }> = (v) => {
    if (!isObject(v)) return undefined;
    const width = numIn(LIMITS.width)(v.width);
    const height = numIn(LIMITS.height)(v.height);
    return width === undefined || height === undefined ? undefined : { width, height };
};

const padding: Check<[number, number]> = (v) => {
    if (!Array.isArray(v) || v.length !== 2) return undefined;
    const [a, b] = v.map(numIn(LIMITS.padding));
    return a === undefined || b === undefined ? undefined : [a, b];
};

/* ---------------- 结构清洗 ---------------- */

type Schema = Record<string, Check<unknown>>;

/** 按 schema 逐字段校验：只保留合法字段，未知字段与非法字段都记录 warning */
function sanitize<T>(raw: unknown, schema: Schema, path: string, warn: Warn): T {
    const out: Record<string, unknown> = {};
    if (raw === undefined) return out as T;
    if (!isObject(raw)) {
        warn(`${path} 应为对象，已忽略`);
        return out as T;
    }
    for (const [key, value] of Object.entries(raw)) {
        const check = schema[key];
        if (!check) {
            warn(`${path}.${key} 是未知字段，已忽略`);
            continue;
        }
        if (value === undefined) continue;
        const result = check(value);
        if (result === undefined) warn(`${path}.${key} 的值 ${JSON.stringify(value)} 非法，已回退`);
        else out[key] = result;
    }
    return out as T;
}

const TEXT_SCHEMA: Schema = {
    fontFamily,
    fontSize: numIn(LIMITS.fontSize),
    fontWeight: numIn(LIMITS.fontWeight),
    lineHeight: numIn(LIMITS.lineHeight),
    letterSpacing: numIn(LIMITS.letterSpacing),
    color: cssValue("color"),
    opacity: numIn([0, 1]),
    align: oneOf("left", "center", "right", "justify"),
    writingMode: oneOf("horizontal", "vertical"),
    visible: bool,
};

const SLOT_SCHEMA: Schema = {
    ...TEXT_SCHEMA,
    position,
    maxWidth: numIn(LIMITS.percent),
};

export function sanitizeCardStyle(raw: unknown, path: string, warn: Warn): CardStyle {
    const style = sanitize<CardStyle>(
        raw,
        {
            size,
            padding,
            gap: numIn(LIMITS.gap),
            background: cssValue("background"),
            radius: numIn(LIMITS.radius),
            // base 与 slots 在下面单独处理
            base: (v) => v,
            slots: (v) => v,
        },
        path,
        warn,
    );

    if (style.base !== undefined) {
        style.base = sanitize<TextStyle>(style.base, TEXT_SCHEMA, `${path}.base`, warn);
    }

    if (style.slots !== undefined) {
        const rawSlots: unknown = style.slots;
        const slots: Partial<Record<SlotId, SlotStyle>> = {};
        if (!isObject(rawSlots)) {
            warn(`${path}.slots 应为对象，已忽略`);
        } else {
            for (const [id, value] of Object.entries(rawSlots)) {
                if (!(SLOT_IDS as readonly string[]).includes(id)) {
                    warn(`${path}.slots.${id} 不是已知插槽（${SLOT_IDS.join(" / ")}），已忽略`);
                    continue;
                }
                slots[id as SlotId] = sanitize<SlotStyle>(value, SLOT_SCHEMA, `${path}.slots.${id}`, warn);
            }
        }
        style.slots = slots;
    }

    return style;
}

/** 校验卡片定义；卡片级错误返回 null */
export function sanitizeCardDef(raw: unknown, warn: Warn): CardDef | null {
    if (!isObject(raw)) {
        warn("卡片定义应为对象");
        return null;
    }
    if (raw.schemaVersion !== CARD_SCHEMA_VERSION) {
        warn(`卡片 schemaVersion 为 ${JSON.stringify(raw.schemaVersion)}，当前仅支持 ${CARD_SCHEMA_VERSION}`);
        return null;
    }
    if (typeof raw.id !== "string" || raw.id.trim() === "") {
        warn("卡片缺少 id");
        return null;
    }
    const id = raw.id;
    const def: CardDef = {
        schemaVersion: CARD_SCHEMA_VERSION,
        id,
        name: typeof raw.name === "string" && raw.name.trim() !== "" ? raw.name : id,
    };
    if (raw.layout !== undefined) {
        if (typeof raw.layout === "string") def.layout = raw.layout;
        else warn(`卡片 "${id}" 的 layout 应为字符串，已忽略`);
    }
    if (raw.extends !== undefined) {
        if (typeof raw.extends === "string") def.extends = raw.extends;
        else warn(`卡片 "${id}" 的 extends 应为字符串，已忽略`);
    }
    if (raw.style !== undefined) def.style = sanitizeCardStyle(raw.style, `卡片 "${id}".style`, warn);
    // template 为预留字段，当前版本不解析
    return def;
}

/* ---------------- 合并 ---------------- */

function applyLayer(acc: ResolvedCardStyle, layer: CardStyle | undefined): ResolvedCardStyle {
    if (!layer) return acc;
    const slots = {} as Record<SlotId, ResolvedSlotStyle>;
    for (const id of SLOT_IDS) {
        slots[id] = { ...acc.slots[id], ...layer.base, ...layer.slots?.[id] };
    }
    return {
        size: layer.size ?? acc.size,
        padding: layer.padding ?? acc.padding,
        gap: layer.gap ?? acc.gap,
        background: layer.background ?? acc.background,
        radius: layer.radius ?? acc.radius,
        slots,
    };
}

/** 字体栈末尾补上 classic 对应插槽的字体栈（其末尾是通用族），保证字体缺失时能自然降级 */
function withFontFallback(style: ResolvedCardStyle): ResolvedCardStyle {
    const slots = {} as Record<SlotId, ResolvedSlotStyle>;
    for (const id of SLOT_IDS) {
        const stack = [...style.slots[id].fontFamily, ...CLASSIC_STYLE.slots[id].fontFamily];
        slots[id] = { ...style.slots[id], fontFamily: [...new Set(stack)] };
    }
    return { ...style, slots };
}

export function resolveCard(cardId: string, ctx: ResolveContext): ResolvedCard {
    const warnings: string[] = [];
    const warn: Warn = (m) => warnings.push(m);

    const load = (id: string): CardDef | null => {
        if (id === CLASSIC_ID) return classicCard;
        const raw = ctx.getCard(id);
        if (raw === undefined) return null;
        const def = sanitizeCardDef(raw, warn);
        if (def && def.id !== id) warn(`卡片 "${id}" 内部的 id 为 "${def.id}"，以注册 id 为准`);
        return def && { ...def, id };
    };

    let def = load(cardId);
    if (!def) {
        warn(`卡片 "${cardId}" 不可用，已回退到 classic`);
        def = classicCard;
    }

    // 收集继承链：[最远的父卡片, ..., 当前卡片]，classic 是隐含的根
    const chain: CardDef[] = [def];
    const seen = new Set([def.id]);
    let current = def;
    while (current.id !== CLASSIC_ID) {
        const parentId = current.extends ?? CLASSIC_ID;
        if (parentId === CLASSIC_ID) break;
        if (seen.has(parentId)) {
            warn(`卡片 "${current.id}" 的继承链存在环（${parentId}），从此处直接继承 classic`);
            break;
        }
        if (chain.length >= MAX_EXTENDS_DEPTH) {
            warn(`卡片 "${def.id}" 的继承层数超过 ${MAX_EXTENDS_DEPTH}，从 "${current.id}" 起直接继承 classic`);
            break;
        }
        const parent = load(parentId);
        if (!parent) {
            warn(`卡片 "${current.id}" 的父卡片 "${parentId}" 不可用，从此处直接继承 classic`);
            break;
        }
        chain.unshift(parent);
        seen.add(parentId);
        current = parent;
    }

    let layout = CLASSIC_ID;
    let style = CLASSIC_STYLE;
    for (const layer of chain) {
        if (layer.layout !== undefined) layout = layer.layout;
        style = applyLayer(style, layer.style);
    }

    if (layout === TEMPLATE_LAYOUT_ID) {
        warn(`卡片 "${def.id}" 使用的 mustache 模板布局尚未实现，已使用 classic 布局`);
        layout = CLASSIC_ID;
    } else if (!ctx.hasLayout(layout)) {
        warn(`卡片 "${def.id}" 使用的布局 "${layout}" 不存在，已使用 classic 布局`);
        layout = CLASSIC_ID;
    }

    return { id: def.id, name: def.name, layout, style: withFontFallback(style), warnings };
}
