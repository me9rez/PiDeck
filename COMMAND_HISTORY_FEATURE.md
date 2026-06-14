# 输入框历史命令导航功能

## 📋 功能概述

实现了类似终端的历史命令导航功能，支持使用上下键快速切换之前输入过的命令，提升重复操作的效率。

## 🎯 核心特性

### 1. **智能触发逻辑**
- ✅ **上键**：仅在光标位于**第一行**时触发历史导航
- ✅ **下键**：仅在光标位于**最后一行**且处于历史导航模式时触发
- ✅ **多行编辑不受影响**：在非首行/末行使用上下键正常移动光标

### 2. **自动退出机制**
- 用户手动编辑内容时，自动退出历史导航模式
- 按下 ESC 键可立即退出并恢复原始输入
- 发送消息后自动重置导航状态

### 3. **持久化存储**
- 历史命令保存到 localStorage（`pideck-command-history`）
- 自动保留最近 50 条命令
- 应用重启后历史记录依然存在

### 4. **智能过滤**
- 自动去重：相同的命令不会重复保存
- 跳过 shell 命令（以 `!` 开头的命令）
- 跳过空白命令

## 🚀 使用方法

### 基础用法

1. **向上导航历史**
   ```
   输入框中按 ↑ → 显示上一条历史命令
   继续按 ↑   → 继续向上翻阅更早的命令
   ```

2. **向下导航历史**
   ```
   按 ↓ → 显示下一条历史命令（较新的）
   继续按 ↓ 到底 → 恢复到最初输入的内容
   ```

3. **退出历史模式**
   ```
   方式1: 直接编辑内容（自动退出）
   方式2: 按 ESC 键（恢复原始输入）
   方式3: 发送消息（自动重置）
   ```

### 多行文本编辑

```
第一行文字 ← 光标在这里，↑ 触发历史导航
第二行文字 ← 光标在这里，↑ 正常移动到上一行
第三行文字 ← 光标在这里，↓ 正常移动到下一行
```

## 🔧 实现细节

### 状态管理

```typescript
// 历史命令列表
const [commandHistory, setCommandHistory] = useState<string[]>([]);

// 当前导航位置（-1 表示未在导航）
const [historyIndex, setHistoryIndex] = useState(-1);

// 是否正在历史导航
const [historyNavigating, setHistoryNavigating] = useState(false);

// 保存导航前的原始输入
const [savedPrompt, setSavedPrompt] = useState("");
```

### 光标位置检测

```typescript
const textarea = event.currentTarget;
const cursorPos = textarea.selectionStart;
const textBeforeCursor = textarea.value.substring(0, cursorPos);
const textAfterCursor = textarea.value.substring(cursorPos);

// 判断是否在第一行
const isFirstLine = !textBeforeCursor.includes('\n');

// 判断是否在最后一行
const isLastLine = !textAfterCursor.includes('\n');
```

### 保存历史命令

```typescript
if (message.trim() && !message.startsWith("!")) {
  setCommandHistory((prev) => {
    // 去重
    const filtered = prev.filter(cmd => cmd !== message.trim());
    // 保留最近 50 条
    const newHistory = [message.trim(), ...filtered].slice(0, 50);
    return newHistory;
  });
}
```

### 持久化

```typescript
// 加载
const savedHistory = localStorage.getItem("pideck-command-history");
if (savedHistory) {
  setCommandHistory(JSON.parse(savedHistory));
}

// 保存
useEffect(() => {
  if (commandHistory.length > 0) {
    localStorage.setItem("pideck-command-history", JSON.stringify(commandHistory));
  }
}, [commandHistory]);
```

## 📊 工作流程

### 1. 首次按上键
```
用户输入: "帮我写一个函数"
按 ↑ 键
→ 保存当前输入到 savedPrompt
→ 显示历史第 1 条命令
→ 进入历史导航模式
```

### 2. 继续导航
```
按 ↑ → 显示历史第 2 条
按 ↑ → 显示历史第 3 条
按 ↓ → 显示历史第 2 条
按 ↓ → 显示历史第 1 条
按 ↓ → 恢复原始输入 "帮我写一个函数"
```

### 3. 手动编辑退出
```
历史命令: "查看日志"
用户修改为: "查看最近的日志"
→ 自动退出历史模式
→ 清空 savedPrompt
```

## 🎨 用户体验

### ✅ 优点

1. **智能判断**：多行文本编辑不受影响
2. **自然退出**：编辑内容自动退出，无需手动操作
3. **持久化**：历史记录跨会话保留
4. **去重优化**：相同命令只保存一次
5. **容量限制**：自动保留最近 50 条，避免无限增长

### 🔄 与其他功能的兼容性

- ✅ **建议框**：历史导航优先级低于建议框（@文件、/命令）
- ✅ **Shell 模式**：`!` 命令不保存到历史
- ✅ **多行输入**：智能判断光标位置，不干扰多行编辑
- ✅ **图片附件**：历史命令与图片附件独立工作

## 🐛 边界情况处理

### 1. 空历史列表
```typescript
if (commandHistory.length > 0) {
  // 只在有历史时才响应上键
}
```

### 2. 导航到顶部
```typescript
const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
// 已经到顶部时不再变化
```

### 3. 导航到底部
```typescript
if (historyIndex > 0) {
  // 继续向下
} else {
  // 恢复原始输入
  setPrompt(savedPrompt);
}
```

### 4. 持久化失败
```typescript
try {
  localStorage.setItem("pideck-command-history", JSON.stringify(commandHistory));
} catch (error) {
  console.error("Failed to save command history:", error);
  // 静默失败，不影响使用
}
```

## 📝 后续优化建议

### 1. **可配置化**
- [ ] 添加设置项：启用/禁用历史命令
- [ ] 可配置历史记录条数（默认 50）
- [ ] 可配置触发条件（仅首行/任意位置）

### 2. **搜索功能**
- [ ] Ctrl+R 触发历史搜索（类似 bash）
- [ ] 模糊搜索历史命令
- [ ] 高亮匹配文本

### 3. **高级特性**
- [ ] 按 Agent/项目隔离历史
- [ ] 历史命令标星/收藏
- [ ] 导出/导入历史记录
- [ ] 显示命令使用频率

### 4. **UI 优化**
- [ ] 显示当前历史位置（如 3/50）
- [ ] 历史命令预览面板
- [ ] 键盘提示（首次使用时）

## 🎉 完成状态

- ✅ 上下键导航历史命令
- ✅ 智能光标位置检测（仅首行/末行）
- ✅ 手动编辑自动退出
- ✅ ESC 键退出并恢复
- ✅ 持久化到 localStorage
- ✅ 自动去重和容量限制
- ✅ 跳过 shell 命令
- ✅ 构建测试通过

## 🔗 相关文件

- **src/renderer/src/App.tsx** - 主要实现
  - 状态管理：`commandHistory`, `historyIndex`, `historyNavigating`, `savedPrompt`
  - 核心逻辑：`handleComposerKeyDown`, `sendPrompt`
  - 持久化：`useEffect` 加载和保存

## 📚 参考实现

- Bash/Zsh 历史命令（Ctrl+R, ↑↓ 导航）
- OpenCode 的实现思路（编辑检测）
- 你的设计建议（仅首行触发）
