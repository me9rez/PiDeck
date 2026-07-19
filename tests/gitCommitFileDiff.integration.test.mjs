import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { after, before, describe, test } from "node:test";

const require = createRequire(import.meta.url);
const buildDir = mkdtempSync(join(tmpdir(), "pideck-git-service-build-"));
const repositoryDir = mkdtempSync(join(tmpdir(), "pideck-git-diff-"));
let GitService;

function git(...args) {
  return execFileSync("git", args, {
    cwd: repositoryDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function write(relativePath, content) {
  writeFileSync(join(repositoryDir, relativePath), content);
}

before(() => {
  // Compile only the service and its shared types so the integration test exercises
  // the real implementation without requiring a complete Electron build first.
  execFileSync(
    process.execPath,
    [
      resolve("node_modules/typescript/bin/tsc"),
      "src/main/git/GitService.ts",
      "src/shared/types.ts",
      "--module",
      "commonjs",
      "--target",
      "es2022",
      "--moduleResolution",
      "node",
      "--esModuleInterop",
      "--skipLibCheck",
      "--outDir",
      buildDir,
    ],
    { cwd: resolve("."), stdio: "pipe" },
  );
  ({ GitService } = require(join(buildDir, "main/git/GitService.js")));

  git("init");
  git("config", "user.name", "PiDeck Test");
  git("config", "user.email", "test@example.com");
});

after(() => {
  rmSync(buildDir, { recursive: true, force: true });
  rmSync(repositoryDir, { recursive: true, force: true });
});

describe("GitService committed-file diff integration", () => {
  test("reads root, modified, added, renamed, deleted, and merge first-parent snapshots", async () => {
    const service = new GitService();

    write("root.txt", "root v1\n");
    git("add", "--", "root.txt");
    git("commit", "-m", "root");
    const root = git("rev-parse", "HEAD");
    assert.deepEqual(await service.getCommitFileDiff(repositoryDir, root, "root.txt"), {
      path: "root.txt",
      originalContent: "",
      modifiedContent: "root v1\n",
    });

    write("root.txt", "root v2\n");
    write("new.txt", "added\n");
    git("add", "--", "root.txt", "new.txt");
    git("commit", "-m", "modify and add");
    const changed = git("rev-parse", "HEAD");
    assert.deepEqual(await service.getCommitFileDiff(repositoryDir, changed, "root.txt"), {
      path: "root.txt",
      originalContent: "root v1\n",
      modifiedContent: "root v2\n",
    });
    assert.deepEqual(await service.getCommitFileDiff(repositoryDir, changed, "new.txt"), {
      path: "new.txt",
      originalContent: "",
      modifiedContent: "added\n",
    });

    git("mv", "new.txt", "renamed.txt");
    git("commit", "-m", "rename");
    const renamed = git("rev-parse", "HEAD");
    assert.deepEqual(
      await service.getCommitFileDiff(repositoryDir, renamed, "renamed.txt", "new.txt"),
      {
        path: "renamed.txt",
        originalPath: "new.txt",
        originalContent: "added\n",
        modifiedContent: "added\n",
      },
    );
    assert.equal(await service.getCommitFileDiff(repositoryDir, renamed, "renamed.txt"), null);

    const mainBranch = git("branch", "--show-current");
    git("checkout", "-b", "feature");
    write("renamed.txt", "feature version\n");
    git("add", "--", "renamed.txt");
    git("commit", "-m", "feature change");
    git("checkout", mainBranch);
    write("main.txt", "main only\n");
    git("add", "--", "main.txt");
    git("commit", "-m", "main change");
    git("merge", "--no-ff", "feature", "-m", "merge feature");
    const merge = git("rev-parse", "HEAD");
    assert.deepEqual(await service.getCommitFileDiff(repositoryDir, merge, "renamed.txt"), {
      path: "renamed.txt",
      originalContent: "added\n",
      modifiedContent: "feature version\n",
    });

    git("rm", "--", "root.txt");
    git("commit", "-m", "delete");
    const deleted = git("rev-parse", "HEAD");
    assert.deepEqual(await service.getCommitFileDiff(repositoryDir, deleted, "root.txt"), {
      path: "root.txt",
      originalContent: "root v2\n",
      modifiedContent: "",
    });
  });

  test("resolves refs before git show and rejects option-like input", async () => {
    const service = new GitService();
    const injectedOutput = join(repositoryDir, "should-not-exist.patch");
    assert.equal(
      await service.getCommitDetail(repositoryDir, `--output=${injectedOutput}`),
      null,
    );
    assert.equal(existsSync(injectedOutput), false);
  });
});
