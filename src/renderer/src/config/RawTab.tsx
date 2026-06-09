import { ConfigSelect } from "./ConfigShared";

// ── Raw Tab ─────────────────────────────────────────────

const RAW_FILE_OPTIONS = [
	{ value: "models.json", label: "models.json" },
	{ value: "auth.json", label: "auth.json" },
	{ value: "settings.json", label: "settings.json" },
];

export function RawTab(props: {
	fileName: string;
	content: string;
	saving: boolean;
	onChangeFileName: (name: string) => void;
	onChangeContent: (content: string) => void;
	onSave: () => void;
}) {
	return (
		<div className="config-raw-tab">
			<div className="config-toolbar">
				<ConfigSelect
					value={props.fileName}
					options={RAW_FILE_OPTIONS}
					onChange={props.onChangeFileName}
				/>
				<button
					className="config-btn primary"
					onClick={props.onSave}
					disabled={props.saving}
				>
					{props.saving ? "保存中…" : "保存"}
				</button>
			</div>
			<textarea
				className="config-raw-editor"
				value={props.content}
				onChange={(e) => props.onChangeContent(e.target.value)}
				spellCheck={false}
			/>
		</div>
	);
}
