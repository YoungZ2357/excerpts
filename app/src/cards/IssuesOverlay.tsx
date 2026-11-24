import "./issues.css";

interface IssuesOverlayProps {
    /** 默认为「卡片问题」 */
    title?: string;
    issues: string[];
    onClose: () => void;
}

/** 问题列表浮层，点击任意位置关闭 */
function IssuesOverlay({ title = "卡片问题", issues, onClose }: IssuesOverlayProps) {
    return (
        <div className="ex-issues" onClick={onClose} role="dialog" aria-label={title}>
            <h2>{title}（{issues.length}）</h2>
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
