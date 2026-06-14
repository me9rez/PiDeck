# Claude 会话导入功能实现文档

## 📋 功能概述

实现了从 Claude Code CLI (`~/.claude/projects`) 导入会话到 PiDeck 的功能，完全复用了现有的 Codex 导入架构。

## 🎯 实现的功能

1. **扫描 Claude 会话**：自动扫描 `~/.claude/projects/项目名/*.jsonl` 中的会话文件
2. **格式转换**：将 Claude Code 的 JSONL 格式转换为 Pi 的会话格式
3. **批量导入**：支持批量选择和导入多个会话
4. **状态管理**：显示会话状态（未导入/已是最新/可覆盖更新）
5. **UI 集成**：在项目右键菜单中添加"导入 Claude 会话"选项

## 📁 修改的文件

### 后端 (Main Process)

1. **src/main/sessions/ClaudeSessionImporter.ts** ⭐ 新建
   - 核心转换器，负责扫描和转换 Claude 会话
   - 参考 `CodexSessionImporter.ts` 实现

2. **src/main/index.ts**
   - 导入 `ClaudeSessionImporter`
   - 初始化实例
   - 添加 IPC 处理器

### 共享类型 (Shared)

3. **src/shared/types.ts**
   - 添加 `ClaudeImportStatus`
   - 添加 `ClaudeSessionSummary`
   - 添加 `ClaudeImportResult`
   - 添加 `ClaudeImportReport`

4. **src/shared/ipc.ts**
   - 添加 `claudeSessionsScan`
   - 添加 `claudeSessionsImport`

### Preload 层

5. **src/preload/index.ts**
   - 导入类型定义
   - 添加 `claudeSessions` API

### 前端 (Renderer)

6. **src/renderer/src/components/app/AppParts.tsx**
   - 添加 `ClaudeImportModal` 组件
   - 添加 `formatClaudeStatus` 函数
   - 更新 `ProjectContextMenu` 添加 Claude 导入选项
   - 导入必要的类型

7. **src/renderer/src/App.tsx**
   - 添加 Claude 导入相关的状态
   - 添加 `openClaudeImport` 函数
   - 添加 `scanClaudeSessions` 函数
   - 添加 `toggleClaudeSession` 函数
   - 添加 `toggleAllClaudeSessions` 函数
   - 添加 `importClaudeSessions` 函数
   - 在右键菜单中连接 Claude 导入
   - 渲染 `ClaudeImportModal`

8. **src/renderer/src/previewApi.ts**
   - 添加 `claudeSessions` 模拟 API

9. **src/renderer/src/i18n.ts**
   - 添加中文翻译（claude.*）
   - 添加英文翻译（claude.*）
   - 添加菜单项翻译

## 🔄 格式转换逻辑

### Claude 格式 → Pi 格式

| Claude 字段 | Pi 字段 | 说明 |
|------------|---------|------|
| `type: "user"` | `role: "user"` | 用户消息 |
| `type: "assistant"` | `role: "assistant"` | 助手消息 |
| `message.content[].type: "text"` | `content[].type: "text"` | 文本内容 |
| `message.content[].type: "thinking"` | `content[].type: "thinking"` | 思考内容 |
| `message.content[].type: "tool_use"` | `content[].type: "toolCall"` | 工具调用 |
| `type: "tool_result"` | `role: "toolResult"` | 工具结果 |
| `uuid` | `id` | 消息ID |
| `parentUuid` | `parentId` | 父消息ID |
| `timestamp` | `timestamp` | 时间戳 |

### 跳过的内容

- `type: "file-history-snapshot"` - 文件历史快照
- `type: "system", subtype: "turn_duration"` - 轮次耗时
- `type: "system", subtype: "api_error"` - API错误

## 🚀 使用方法

1. **打开项目右键菜单**
   - 在项目列表中右键点击任意项目

2. **选择"导入 Claude 会话"**
   - 系统会自动扫描 `~/.claude/projects` 中匹配该项目路径的会话

3. **选择要导入的会话**
   - 勾选需要导入的会话（支持全选/取消全选）
   - 查看会话状态：
     - 🟢 **未导入** - 新会话
     - 🔵 **已是最新** - 已导入且为最新版本
     - 🟡 **可覆盖更新** - 已导入但源文件已更新

4. **点击导入**
   - 批量导入选中的会话
   - 查看导入结果报告

## 🔍 技术细节

### 路径映射

Claude Code 使用特殊的目录命名格式：
```
C:\Users\14012\pi-desktop
  ↓
~/.claude/projects/C--Users-14012-pi-desktop/
```

### 会话 ID 生成

- 优先使用 Claude 的 `sessionId`
- 如果缺失，使用文件路径的 SHA1 哈希

### 去重机制

- 导入时在会话文件第二行写入 `claude_import` 元数据
- 记录源文件的 `mtime` 和 `size`
- 根据这些信息判断会话状态

### 重复导入

- 同一个 Claude 会话重复导入会覆盖之前的导入
- 目标文件名格式：`claude_<sessionId>.jsonl`
- 原始 Claude 会话文件保持不变

## ✅ 测试建议

1. **基础导入**
   ```bash
   # 确保有 Claude 会话存在
   ls ~/.claude/projects/*/
   
   # 在 PiDeck 中右键项目 → 导入 Claude 会话
   ```

2. **状态测试**
   - 导入一次，状态应为"已是最新"
   - 修改源文件，再次扫描应为"可覆盖更新"
   - 删除导入的会话，再次扫描应为"未导入"

3. **边界情况**
   - 空项目（无会话）
   - 大量会话（100+ 个）
   - 损坏的 JSONL 文件

## 🎨 UI 说明

### 导入弹窗布局

```
┌─────────────────────────────────────┐
│ 导入 Claude 会话                     │
│ 项目名称                             │
├─────────────────────────────────────┤
│ N 个可导入会话  [刷新] [全选] [导入] │
├─────────────────────────────────────┤
│ ☑ 会话标题 1        【未导入】        │
│   预览文本...                        │
│   2024-06-14 · 10 条消息 · 45 KB    │
│                                     │
│ ☑ 会话标题 2        【已是最新】      │
│   预览文本...                        │
└─────────────────────────────────────┘
```

## 🐛 已知限制

1. **工具调用映射**
   - Claude 的工具调用可能包含更复杂的参数结构
   - 当前实现做了基础的 `input` 字段映射

2. **思考内容**
   - 标记为 `claude_thinking` 而非原生 Pi 的 thinking

3. **Token 统计**
   - 导入的会话 usage 字段为 0（Claude 原始历史无此字段）

## 📝 后续优化建议

1. **增量同步**
   - 添加"自动同步"选项
   - 定期检查 Claude 会话更新

2. **双向同步**
   - 支持将 PiDeck 会话导出为 Claude 格式

3. **选择性导入**
   - 按日期范围筛选
   - 按消息数量筛选
   - 搜索功能

4. **预览功能**
   - 在导入前预览会话内容
   - 显示更详细的统计信息

## 🎉 完成状态

- ✅ 后端核心转换器
- ✅ IPC 通道
- ✅ 前端 UI 组件
- ✅ 右键菜单集成
- ✅ 国际化（中文/英文）
- ✅ 类型定义
- ✅ 构建测试通过

## 📚 参考资料

- Claude Code CLI 文档：https://claude.ai/code
- Codex 导入实现：`src/main/sessions/CodexSessionImporter.ts`
- Pi 会话格式：JSONL 格式，每行一个 JSON 对象
