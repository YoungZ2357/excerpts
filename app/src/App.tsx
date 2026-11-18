import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Excerpt } from "@excerpts/schema";
import { getLayout } from "./cards/registry";

function App() {
    const [excerpt, setExcerpt] = useState<Excerpt | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { Component } = getLayout("classic");

    async function next() {
        try {
            setExcerpt(await invoke<Excerpt | null>("random_excerpt"));
            setError(null);
        } catch (e) {
            setError(String(e));
        }
    }

    useEffect(() => { void next(); }, []);

    if (error) return <p style={{ color: "red" }}>{error}</p>;
    return excerpt ? <Component excerpt={excerpt} onNext={next} /> : <p>暂无摘抄</p>;
}

export default App;