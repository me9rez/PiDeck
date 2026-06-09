import { useState } from "react";
import type { MouseEvent } from "react";
import { Check, Eye, EyeOff, ChevronDown } from "lucide-react";
import { PROVIDER_API_OPTIONS } from "./providerHeaders";

// ── 复制到剪贴板工具 ──────────────────────────────────

export function CopyButton(props: { text: string }) {
	const [copied, setCopied] = useState(false);
	const handleCopy = async (e: MouseEvent) => {
		e.stopPropagation();
		try {
			await navigator.clipboard.writeText(props.text);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			/* 静默失败 */
		}
	};
	return (
		<button
			className={`config-copy-btn ${copied ? "copied" : ""}`}
			onClick={handleCopy}
			title="复制"
		>
			{copied ? (
				<>
					<Check size={14} /> 已复制
				</>
			) : (
				"复制"
			)}
		</button>
	);
}

/** 密码输入框：支持显示/隐藏 + 复制 */
export function SecretInput(props: {
	value: string;
	onChange: (v: string) => void;
	placeholder?: string;
}) {
	const [visible, setVisible] = useState(false);
	return (
		<div className="config-secret-input">
			<input
				type={visible ? "text" : "password"}
				value={props.value}
				onChange={(e) => props.onChange(e.target.value)}
				placeholder={props.placeholder ?? "sk-..."}
			/>
			<button
				className="config-eye-btn"
				onClick={() => setVisible(!visible)}
				title={visible ? "隐藏" : "显示"}
			>
				{visible ? <EyeOff size={15} /> : <Eye size={15} />}
			</button>
			<CopyButton text={props.value} />
		</div>
	);
}

// ── Models Tab ──────────────────────────────────────────

export function ConfigSelect(props: {
	value: string;
	options: Array<{ value: string; label: string }>;
	onChange: (value: string) => void;
	placeholder?: string;
}) {
	const [open, setOpen] = useState(false);
	const selected = props.options.find((option) => option.value === props.value);
	return (
		<div
			className="config-combobox config-select"
			onBlur={() => {
				// 和 API 类型 combobox 保持一致：先让选项 mouseDown 完成，再关闭菜单。
				window.setTimeout(() => setOpen(false), 80);
			}}
		>
			<button
				type="button"
				className="config-select-trigger"
				onFocus={() => setOpen(true)}
				onMouseDown={(e) => {
					e.preventDefault();
					setOpen((current) => !current);
				}}
			>
				<span>{selected?.label ?? props.placeholder ?? props.value}</span>
				<ChevronDown size={14} />
			</button>
			{open && (
				<div className="config-combobox-menu">
					{props.options.map((option) => (
						<button
							key={option.value || "none"}
							type="button"
							className={option.value === props.value ? "active" : ""}
							onMouseDown={(e) => {
								e.preventDefault();
								props.onChange(option.value);
								setOpen(false);
							}}
						>
							{option.label}
						</button>
					))}
				</div>
			)}
		</div>
	);
}

/** API 类型输入：自定义 combobox，避免原生 datalist 在 Electron 滚动容器中出现弹层错位或选项显示不完整。 */
export function ApiTypeInput(props: {
	value: string;
	onChange: (value: string) => void;
}) {
	const [open, setOpen] = useState(false);

	return (
		<div
			className="config-combobox"
			onBlur={() => {
				// 等待 option 的 mouseDown 先写入值，再关闭下拉，避免点击被 blur 截断。
				window.setTimeout(() => setOpen(false), 80);
			}}
		>
			<input
				value={props.value}
				onFocus={() => setOpen(true)}
				onChange={(e) => {
					props.onChange(e.target.value);
					setOpen(true);
				}}
				placeholder="选择或输入 API 类型"
			/>
			<button
				type="button"
				className="config-combobox-toggle"
				onMouseDown={(e) => {
					e.preventDefault();
					setOpen((current) => !current);
				}}
				title="展开 API 类型选项"
			>
				<ChevronDown size={14} />
			</button>
			{open && (
				<div className="config-combobox-menu">
					{PROVIDER_API_OPTIONS.map((option) => (
						<button
							key={option}
							type="button"
							className={option === props.value ? "active" : ""}
							onMouseDown={(e) => {
								e.preventDefault();
								props.onChange(option);
								setOpen(false);
							}}
						>
							{option}
						</button>
					))}
				</div>
			)}
		</div>
	);
}


