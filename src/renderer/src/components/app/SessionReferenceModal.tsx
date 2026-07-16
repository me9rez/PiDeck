import { useCallback, useEffect, useMemo, useState } from "react";
import { X, MessageCircle, Brain, FileText } from "lucide-react";
import { t } from "../../i18n";
import type { SessionSummary } from "../../../../shared/types";
import { summarizeMessage, stripAnsi } from "./AppUtils";

type SessionMessage = { role: string; content: string; timestamp: number };

/** 相邻 user+assistant 对，复用多选分享的 agent-run 树结构 */
type SessionTurn = {
	key: string;
	user: SessionMessage;
	assistant: SessionMessage | null;
};

export type SessionReferenceResult = {
	sessionName: string;
	messages: SessionMessage[];
	fullContext: boolean;
};

export function SessionReferenceModal(props: {
	session: SessionSummary;
	onClose: () => void;
	onConfirm: (result: SessionReferenceResult, selectedIndices: number[]) => void;
	loadMessages: (filePath: string) => Promise<SessionMessage[]>;
	/** 上次保存的选择（索引集合），null 或空 = 全选 */
	initialSelected?: Set<number>;
}) {
	const [messages, setMessages] = useState<SessionMessage[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [selectedIds, setSelectedIds] = useState<Set<number>>(() => props.initialSelected ?? new Set());

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setError(null);
		props.loadMessages(props.session.filePath).then((msgs) => {
			if (!cancelled) {
				setMessages(msgs);
				// 恢复上次选择，无则全选
				if (props.initialSelected && props.initialSelected.size > 0) {
					setSelectedIds(props.initialSelected);
				} else {
					setSelectedIds(new Set(msgs.map((_, i) => i)));
				}
				setLoading(false);
			}
		}).catch((err) => {
			if (!cancelled) { setError(String(err)); setLoading(false); }
		});
		return () => { cancelled = true; };
	}, [props.session.filePath]);

	// 将消息按 user→assistant 分组为 turns
	const turns = useMemo(() => {
		const result: SessionTurn[] = [];
		let i = 0;
		while (i < messages.length) {
			const msg = messages[i];
			if (msg.role === "user") {
				const next = messages[i + 1];
				result.push({
					key: `t${i}`,
					user: msg,
					assistant: next?.role === "assistant" ? next : null,
				});
				i += next?.role === "assistant" ? 2 : 1;
			} else if (msg.role === "assistant") {
				result.push({ key: `t${i}`, user: msg, assistant: null });
				i++;
			} else {
				i++;
			}
		}
		return result;
	}, [messages]);

	const toggleMessage = useCallback((index: number) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			next.has(index) ? next.delete(index) : next.add(index);
			return next;
		});
	}, []);

	/** 切换整个 turn：同时勾选/取消 user + assistant */
	const toggleTurn = useCallback((turnStart: number, hasAssistant: boolean) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			const ids = [turnStart];
			if (hasAssistant) ids.push(turnStart + 1);
			const allSelected = ids.every((id) => next.has(id));
			for (const id of ids) {
				if (allSelected) next.delete(id);
				else next.add(id);
			}
			return next;
		});
	}, []);

	const toggleAll = useCallback(() => {
		setSelectedIds((prev) =>
			prev.size === messages.length ? new Set() : new Set(messages.map((_, i) => i))
		);
	}, [messages.length]);

	const handleConfirm = useCallback(() => {
		const indices = Array.from(selectedIds).sort((a, b) => a - b);
		const selected = indices.map((i) => messages[i]);
		props.onConfirm({
			sessionName: props.session.name ?? props.session.filePath,
			messages: selected,
			fullContext: selected.length === messages.length,
		}, indices);
	}, [messages, selectedIds, props]);

	const selectedCount = selectedIds.size;
	const allSelected = selectedCount === messages.length;

	return (
		<div className="multi-select-modal-overlay" onClick={props.onClose}>
			<div className="multi-select-modal session-ref-modal" onClick={(e) => e.stopPropagation()}>
				<header className="multi-select-modal-header">
					<h3>
						{t("sessionRef.title")}:{" "}
						<span className="session-ref-name">{props.session.name ?? props.session.filePath}</span>
					</h3>
					<button className="multi-select-modal-close" onClick={props.onClose} aria-label={t("common.close")}>
						<X size={18} strokeWidth={2} />
					</button>
				</header>

				<div className="multi-select-modal-tree session-ref-message-list">
					{loading && <div className="session-ref-loading">{t("common.loading")}...</div>}
					{error && <div className="session-ref-error">{t("sessionRef.loadError")}: {error}</div>}
					{!loading && !error && turns.map((turn, ti) => {
						const userIdx = messages.indexOf(turn.user);
						const assistantIdx = turn.assistant ? messages.indexOf(turn.assistant) : -1;
						const userChecked = selectedIds.has(userIdx);
						const assistantChecked = assistantIdx >= 0 && selectedIds.has(assistantIdx);
						const hasAssistant = turn.assistant !== null;
						const turnAnyChecked = userChecked || assistantChecked;

						return (
							<div key={turn.key} className="multi-select-tree-run">
								{/* User 消息 — 作为 turn 的父行 */}
								<label
									className={`multi-select-tree-node run-parent${turnAnyChecked ? " selected" : ""}`}
								>
									<input
										type="checkbox"
										checked={userChecked}
										onChange={() => toggleTurn(userIdx, hasAssistant)}
									/>
									<MessageCircle size={15} className="multi-select-node-icon user" />
									<span className="multi-select-node-label">
										<span className="multi-select-node-run-label">You</span>
										<span className="multi-select-node-summary">
											{summarizeMessage(stripAnsi(turn.user.content))}
										</span>
									</span>
								</label>

								{/* Assistant 子行 */}
								{hasAssistant && (
									<div className="multi-select-run-children">
										<label
											className={`multi-select-tree-node run-child${assistantChecked ? " selected" : ""}`}
										>
											<input
												type="checkbox"
												checked={assistantChecked}
												onChange={() => toggleMessage(assistantIdx)}
											/>
											<FileText size={14} className="multi-select-node-icon child" />
											<span className="multi-select-node-label">
												<span className="multi-select-node-summary">
													{summarizeMessage(stripAnsi(turn.assistant!.content))}
												</span>
											</span>
										</label>
									</div>
								)}

								{/* 无 assistant 的独立消息（system/error 等显示为单独子行） */}
								{!hasAssistant && turn.user.role === "assistant" && (
									<div className="multi-select-run-children">
										<label
											className={`multi-select-tree-node run-child${userChecked ? " selected" : ""}`}
										>
											<input type="checkbox" checked={userChecked} onChange={() => toggleMessage(userIdx)} />
											<Brain size={14} className="multi-select-node-icon assistant" />
											<span className="multi-select-node-label">
												<span className="multi-select-node-summary">
													{summarizeMessage(stripAnsi(turn.user.content))}
												</span>
											</span>
										</label>
									</div>
								)}
							</div>
						);
					})}
				</div>

				<footer className="multi-select-modal-footer">
					<div className="multi-select-modal-footer-top">
						<span className="multi-select-count">
							{allSelected
								? t("sessionRef.messageCount", { count: messages.length })
								: t("sessionRef.selectedCount", { count: selectedCount, total: messages.length })}
						</span>
						<div className="multi-select-bulk-actions">
							<button className="multi-select-bulk-btn" onClick={toggleAll} disabled={!messages.length}>
								{allSelected ? t("common.deselectAll") : t("common.selectAll")}
							</button>
						</div>
					</div>
					<div className="multi-select-modal-footer-bottom">
						<button
							className="multi-select-action-btn"
							disabled={loading || !!error || selectedCount === 0}
							onClick={handleConfirm}
						>
							{allSelected
								? t("sessionRef.insertAll", { count: messages.length })
								: t("sessionRef.insertSelected", { count: selectedCount })}
						</button>
					</div>
				</footer>
			</div>
		</div>
	);
}
