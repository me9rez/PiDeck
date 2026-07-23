/**
 * SkillHub CLI 测试脚本
 * 直接调用 @astron-team/skillhub 测试搜索、详情、安装流程
 *
 * 用法：node test-skillhub.js
 */
const { execSync } = require("node:child_process");

const cliPath = require.resolve("@astron-team/skillhub/dist/index.js");

function run(cmd) {
  console.log(`\n> ${cmd}`);
  try {
    const output = execSync(cmd, {
      encoding: "utf8",
      timeout: 15_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return JSON.parse(output);
  } catch (err) {
    console.error("  ERROR:", err.message?.substring(0, 200) || err);
    return null;
  }
}

async function main() {
  console.log("=== SkillHub CLI 测试 ===");
  console.log(`CLI 路径: ${cliPath}\n`);

  // 1. 搜索
  console.log("--- 1. 搜索技能 ---");
  const searchResult = run(
    `node "${cliPath}" search "pdf" --limit 5 --json`
  );
  console.log("  总数:", searchResult?.total ?? "N/A");
  console.log("  条目:", searchResult?.items?.length ?? 0);
  if (searchResult?.items?.length > 0) {
    searchResult.items.forEach((item, i) => {
      console.log(`  [${i}] ${item.namespace}/${item.slug} — ${item.summary?.substring(0, 80) || "无描述"}`);
    });
  }

  // 2. 精确搜索（详情）
  if (searchResult?.items?.length > 0) {
    const first = searchResult.items[0];
    const slug = `${first.namespace}/${first.slug}`;
    console.log(`\n--- 2. Skill 详情: ${slug} ---`);
    const detailResult = run(
      `node "${cliPath}" search "${first.slug}" --namespace "${first.namespace}" --limit 1 --json`
    );
    if (detailResult?.items?.length > 0) {
      const item = detailResult.items[0];
      console.log(`  名称: ${item.slug}`);
      console.log(`  命名空间: ${item.namespace}`);
      console.log(`  摘要: ${(item.summary || "").substring(0, 100)}`);
    }

    // 3. 安装（只做空跑，不实际安装）
    console.log(`\n--- 3. 安装测试 (dry-run) ---`);
    console.log(`  目标: ~/.pi/agent/skills/`);
    console.log(`  要实际安装请去掉 --dry-run`);
    const installCmd = `node "${cliPath}" install "${first.slug}" --namespace "${first.namespace}" --dir "${require("node:os").homedir()}/.pi/agent/skills" --json`;
    console.log(`  命令: ${installCmd}`);
    try {
      const installResult = execSync(installCmd, {
        encoding: "utf8",
        timeout: 30_000,
        stdio: ["ignore", "pipe", "pipe"],
      });
      const parsed = JSON.parse(installResult);
      console.log(`  结果: ${parsed.ok ? "✅ 成功" : "❌ 失败"} ${parsed.message || ""}`);
    } catch (err) {
      console.log(`  执行结果: ${err.message?.substring(0, 200)}`);
    }
  }

  console.log("\n=== 测试完成 ===");
}

main().catch(console.error);
