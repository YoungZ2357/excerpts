import { CARD_SCHEMA_VERSION, type CardDef } from "@excerpts/schema";

/** 纵向：竖长窗口，原文竖排从右往左，出处做成左上角的印章，下方横排译文，右下角显示章节 */
export const verticalCard: CardDef = {
    schemaVersion: CARD_SCHEMA_VERSION,
    id: "vertical",
    name: "纵向",
    layout: "vertical",
    style: {
        size: { width: 320, height: 500 },
        padding: [36, 28],
        gap: 12,
        background: "#FFFFFF",
        radius: 14,
        slots: {
            text: {
                fontSize: 26,
                fontWeight: 400,
                lineHeight: 1.9,
                letterSpacing: 0.3,
                color: "#1F1F1F",
                align: "left",
                writingMode: "vertical",
            },
            translation: { fontSize: 17, fontWeight: 400, lineHeight: 1.7, color: "#555555", opacity: 1 },
            source: {
                fontSize: 17,
                fontWeight: 400,
                lineHeight: 1.3,
                letterSpacing: 0.1,
                color: "#8A3B1C",
                opacity: 1,
                writingMode: "vertical",
            },
            path: { fontSize: 16, fontWeight: 400, color: "#666666", opacity: 1, align: "right", visible: true },
        },
    },
};
