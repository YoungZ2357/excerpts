import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Excerpt } from "@excerpts/schema";
import { getLayout } from "./cards/registry";

function App() {
    const [excerpt, setExcerpt] = useState<Excerpt | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { Component } = getLayout("classic");

    // 只在 Promise 回调里 setState，避免在 effect 体内同步触发更新
    function load(isActive: () => boolean = () => true) {
        invoke<Excerpt | null>("random_excerpt").then(
            (result) => {
                if (!isActive()) return;
                setExcerpt(result);
                setError(null);
            },
            (e: unknown) => {
                if (isActive()) setError(String(e));
            },
        );
    }

    const next = () => load();

    useEffect(() => {
        let active = true;
        load(() => active);
        return () => { active = false; };
    }, []);

    if (error) return <p style={{ color: "red" }}>{error}</p>;
    return excerpt ? <Component excerpt={excerpt} onNext={next} /> : <p>暂无摘抄</p>;
}

export default App;