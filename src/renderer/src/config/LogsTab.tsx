import { useEffect, useMemo, useState } from "react";
import type { PiDesktopApi } from "../../../preload";
import type { AppLogEntry, AppLogLevel } from "../../../shared/types";
import { t } from "../i18n";

const api: PiDesktopApi = (window as unknown as { piDesktop: PiDesktopApi }).piDesktop;
const LEVELS: Array<AppLogLevel | "all"> = ["all", "debug", "info", "warn", "error"];

function formatTime(time: number) {
	return new Date(time).toLocaleString();
}

function formatDetail(detail: unknown) {
	if (detail == null) return "";
	try {
		return JSON.stringify(detail, null, 2);
	} catch {
		return String(detail);
	}
}

/** 设置页日志面板：从主进程日志文件读取最近行为,用于用户反馈和故障排查。 */
export function LogsTab() {
	const [entries, setEntries] = useState<AppLogEntry[]>([]);
	const [loading, setLoading] = useState(false);
	const [level, setLevel] = useState<AppLogLevel | "all">("all");
	const [search, setSearch] = useState("");
	const [from, setFrom] = useState("");
	const [to, setTo] = useState("");
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const query = useMemo(() => ({
		level,
		search,
		from: from ? new Date(from).getTime() : undefined,
		to: to ? new Date(to).getTime() : undefined,
		limit: 500,
	}), [level, search, from, to]);

	const refresh = async () => {
		setLoading(true);
		setError(null);
		try {
			setEntries(await api.logs.list(query));
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void refresh();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const clear = async () => {
		if (!window.confirm(t("logs.clearConfirm"))) return;
		await api.logs.clear();
		await refresh();
	};

	return (
		<div className="logs-tab">
			<div className="config-toolbar logs-toolbar">
				<div className="logs-filters">
					<select value={level} onChange={(event) => setLevel(event.target.value as AppLogLevel | "all")}> 
						{LEVELS.map((item) => (
							<option key={item} value={item}>{t(`logs.level.${item}`)}</option>
						))}
					</select>
					<input
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder={t("logs.searchPlaceholder")}
					/>
					<input type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} />
					<input type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} />
				</div>
				<div className="skills-toolbar-actions">
					<button className="config-btn" onClick={refresh} disabled={loading}>{t("common.refresh")}</button>
					<button className="config-btn" onClick={() => api.logs.openFolder()}>{t("logs.openFolder")}</button>
					<button className="config-btn danger" onClick={clear}>{t("logs.clear")}</button>
				</div>
			</div>
			<p className="config-im-form-hint">{t("logs.hint")}</p>
			{error && <div className="config-error">{error}</div>}
			{loading ? (
				<div className="config-loading">{t("common.loading")}</div>
			) : entries.length === 0 ? (
				<div className="config-empty">{t("logs.empty")}</div>
			) : (
				<div className="logs-list">
					{entries.map((entry) => {
						const expanded = expandedId === entry.id;
						return (
							<article key={entry.id} className={`log-row ${entry.level}`}>
								<button className="log-row-main" onClick={() => setExpandedId(expanded ? null : entry.id)}>
									<span className="log-time">{formatTime(entry.time)}</span>
									<span className={`log-level ${entry.level}`}>{entry.level}</span>
									<span className="log-scope">{entry.scope}</span>
									<span className="log-message">{entry.message}</span>
								</button>
								{expanded && (
									<pre className="log-detail">{formatDetail(entry.detail) || t("logs.noDetail")}</pre>
								)}
							</article>
						);
					})}
				</div>
			)}
		</div>
	);
}
