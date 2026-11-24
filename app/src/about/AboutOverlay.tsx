import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { NOTICES } from "./notices.ts";
import "../cards/issues.css";
import "./about.css";

interface AboutOverlayProps {
    onClose: () => void;
}

/** 关于与第三方许可浮层，点击任意位置关闭 */
function AboutOverlay({ onClose }: AboutOverlayProps) {
    const [version, setVersion] = useState<string | null>(null);
    useEffect(() => {
        if (!isTauri()) return;
        getVersion().then(setVersion, () => {});
    }, []);

    return (
        <div className="ex-issues ex-about" onClick={onClose} role="dialog" aria-label="关于与许可">
            <h2>Excerpts{version ? ` v${version}` : ""}</h2>
            <p>在桌面卡片上随机显示一句摘抄。</p>
            <h3>第三方许可</h3>
            {NOTICES.map((n) => (
                <section key={n.name}>
                    <p>
                        <strong>{n.name}</strong> {n.version}
                        <br />
                        {n.copyright}
                        <br />
                        许可：{n.license}
                        <br />
                        来源：{n.url}
                    </p>
                    {n.note && <p>{n.note}</p>}
                    <pre>{n.text}</pre>
                </section>
            ))}
            <p className="ex-issues-hint">点击任意位置关闭</p>
        </div>
    );
}

export default AboutOverlay;
