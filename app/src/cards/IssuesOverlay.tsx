import "./issues.css";

interface IssuesOverlayProps {
    issues: string[];
    onClose: () => void;
}

/** 卡片问题列表浮层，点击任意位置关闭 */
function IssuesOverlay({ issues, onClose }: IssuesOverlayProps) {
    return (
        <div className="ex-issues" onClick={onClose} role="dialog" aria-label="卡片问题">
            <h2>卡片问题（{issues.length}）</h2>
            {issues.length === 0 ? (
                <p>没有问题</p>
            ) : (
                <ol>
                    {issues.map((issue, i) => <li key={i}>{issue}</li>)}
                </ol>
            )}
            <p className="ex-issues-hint">点击任意位置关闭</p>
        </div>
    );
}

export default IssuesOverlay;
