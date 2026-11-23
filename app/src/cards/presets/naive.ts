import { CARD_SCHEMA_VERSION, type CardDef } from "@excerpts/schema";

/** 极简：只显示原文，居中、大字号；复用 classic 布局，只靠样式实现 */
export const naiveCard: CardDef = {
    schemaVersion: CARD_SCHEMA_VERSION,
    id: "naive",
    name: "极简",
    extends: "classic",
    style: {
        slots: {
            text: {
                fontSize: 32,
                lineHeight: 1.4,
                align: "center",
                position: { x: 50, y: 50, anchor: "center" },
                maxWidth: 90,
            },
            translation: { visible: false },
            source: { visible: false },
            path: { visible: false },
        },
    },
};
