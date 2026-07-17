import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { GitBranchInfo } from "../../shared/types";

const execFileAsync = promisify(execFile);

export class GitService {
	/**
	 * 判断给定目录是否处于一个 git 仓库内。
	 * 启用工作区模式前做前置校验，避免非 git 项目开启后只能看到空列表、
	 * 直到点击"新建工作区"才在 create 阶段报错。
	 */
	async isGitRepo(cwd: string): Promise<boolean> {
		try {
			await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"], { cwd });
			return true;
		} catch {
			return false;
		}
	}

	async getBranches(cwd: string): Promise<GitBranchInfo> {
		try {
			// 获取当前分支和所有本地分支（不包含远程分支）
			const [{ stdout: currentRaw }, { stdout: localRaw }] = await Promise.all([
				execFileAsync("git", ["branch", "--show-current"], { cwd }),
				execFileAsync("git", ["branch", "--format=%(refname:short)"], { cwd }),
			]);

			const current = currentRaw.trim() || null;
			const branches = localRaw
				.split(/\r?\n/)
				.map((b) => b.trim())
				.filter(Boolean);

			// 当前分支排在最前
			const sorted = current
				? [current, ...branches.filter((b) => b !== current)]
				: branches;

			return { current, branches: sorted };
		} catch {
			// 非 Git 目录或未安装 git 时只返回空信息，UI 可以降级展示为 no git。
			return { current: null, branches: [] };
		}
	}

	async checkout(cwd: string, branch: string): Promise<GitBranchInfo> {
		try {
			await execFileAsync("git", ["checkout", branch], { cwd });
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			// execFile 默认只输出 stdout；checkout 失败时 stderr 包含真正原因。
			throw new Error(`Git checkout "${branch}" failed: ${msg}`);
		}
		return this.getBranches(cwd);
	}

	/**
	 * 基于当前分支创建新分支并切换。
	 * 使用 checkout -b 命令在当前分支基础上创建新分支。
	 */
	async createBranch(cwd: string, branchName: string): Promise<GitBranchInfo> {
		await execFileAsync("git", ["checkout", "-b", branchName], { cwd });
		return this.getBranches(cwd);
	}

	/**
	 * 读取文件在 Git HEAD 中的原始内容，用于差异编辑器左侧基准列。
	 *
	 * 策略：通过 rev-parse 找到仓库根，用 node path.relative 计算 repoRoot→filePath 的相对路径，
	 * 再用 git -C repoRoot show HEAD:<relpath> 获取 HEAD 版本。
	 *
	 * 边界条件：
	 * - 文件不在任何 Git 仓库内（git 命令失败）→ 返回空字符串。
	 * - 文件是未跟踪的新增文件（HEAD 中不存在该路径）→ git show 报错，返回空字符串。
	 */
	async getOriginalContent(filePath: string): Promise<string> {
		try {
			const dir = dirname(filePath);
			const { stdout: rootRaw } = await execFileAsync(
				"git",
				["rev-parse", "--show-toplevel"],
				{ cwd: dir },
			);
			const repoRoot = rootRaw.trim();
			if (!repoRoot) return "";

			// 用 path.relative 计算相对路径，node 会自动处理跨平台分隔符
			const relPath = relative(repoRoot, filePath).replace(/\\/g, "/");
			if (!relPath || relPath.startsWith("..")) return "";

			const { stdout } = await execFileAsync(
				"git",
				["-C", repoRoot, "show", `HEAD:${relPath}`],
				{ maxBuffer: 32 * 1024 * 1024 },
			);
			return stdout;
		} catch {
			return "";
		}
	}

	/**
	 * 获取工作区中相对于 HEAD 被修改的文件列表（包括已暂存和未暂存的修改，
	 * 以及未跟踪的新增文件）。前端根据此列表展示 Git 工作区变动概览。
	 * 返回 { path, status } 数组，status 值为 "modified" | "added" | "deleted" | "renamed"。
	 */
	async getChangedFiles(
		cwd: string,
	): Promise<{ path: string; status: string }[]> {
		try {
			const { stdout: repoRootRaw } = await execFileAsync(
				"git",
				["rev-parse", "--show-toplevel"],
				{ cwd },
			);
			const repoRoot = resolve(repoRootRaw.trim());
			const projectRoot = resolve(cwd);
			const [{ stdout: stagedRaw }, { stdout: unstagedRaw }, { stdout: untrackedRaw }] =
				await Promise.all([
					execFileAsync(
						"git",
						["diff", "--cached", "--name-status", "-z", "--diff-filter=ACDMR"],
						{ cwd: repoRoot },
					),
					execFileAsync(
						"git",
						["diff", "--name-status", "-z", "--diff-filter=ACDMR"],
						{ cwd: repoRoot },
					),
					execFileAsync(
						"git",
						["ls-files", "--others", "--exclude-standard", "-z"],
						{ cwd: repoRoot },
					),
				]);

			const files: { path: string; status: string }[] = [];
			const seen = new Set<string>();

			// Git 始终返回仓库根相对路径；嵌套项目只展示自己目录内的变更。
			const addFile = (repoRelativePath: string, status: string) => {
				if (!repoRelativePath) return;
				const absolutePath = resolve(repoRoot, repoRelativePath);
				const projectRelativePath = relative(projectRoot, absolutePath);
				if (
					projectRelativePath === ".." ||
					projectRelativePath.startsWith(`..${sep}`) ||
					isAbsolute(projectRelativePath) ||
					seen.has(absolutePath)
				) return;
				seen.add(absolutePath);
				files.push({ path: absolutePath, status });
			};

			// `-z` 让 Git 用 NUL 分隔状态和路径，避免空格、引号或非 ASCII 文件名被拆坏。
			// rename/copy 会额外返回旧路径；文件树徽标应绑定到当前存在的新路径。
			const addDiffEntries = (raw: string) => {
				const fields = raw.split("\0");
				for (let index = 0; index < fields.length - 1; ) {
					const statusToken = fields[index++];
					const statusChar = statusToken[0];
					const oldOrCurrentPath = fields[index++];
					const isRenameOrCopy = statusChar === "R" || statusChar === "C";
					const currentPath = isRenameOrCopy ? fields[index++] : oldOrCurrentPath;
					const status =
						statusChar === "A" ? "added"
							: statusChar === "D" ? "deleted"
								: statusChar === "R" ? "renamed"
									: "modified";
					addFile(currentPath, status);
				}
			};

			addDiffEntries(stagedRaw);
			addDiffEntries(unstagedRaw);

			for (const path of untrackedRaw.split("\0")) {
				addFile(path, "added");
			}

			return files;
		} catch {
			return [];
		}
	}
}
