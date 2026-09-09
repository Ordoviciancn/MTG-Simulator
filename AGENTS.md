# MTG Tabletop 项目协作说明

## 项目定位

MTG Tabletop 是面向朋友娱乐对局的双人网页牌桌，不是完整万智牌规则引擎。默认手动模式由玩家裁定；辅助模式仅对明确支持的牌处理费用、目标和结算，不实现完整优先权、战斗或状态动作。

## 技术与目录

- 前端：React、Vite、TypeScript，主要代码位于 `src/client`。
- 服务端：Express、WebSocket `ws`，位于 `src/server`。
- 共享消息协议与类型：`src/shared/types.ts`。
- Windows 启动与远程联机脚本：`scripts`。
- 用户文档：`README.md`；快速工程上下文：`PROJECT_CONTEXT.md`。

## 常用命令

```powershell
pnpm install
pnpm dev
pnpm test
pnpm build
pnpm start
```

修改前后端消息协议时，必须同步检查 `src/shared/types.ts`、`src/server/index.ts` 和 `src/client/App.tsx`。提交前运行 `pnpm test` 和 `pnpm build`。

## 长期约束

- 隐藏信息的公开边界必须由服务端或独立状态模型保证，不能只靠 CSS 隐藏。
- 手牌、牌库、看顶和换备等私密操作不得泄露真实卡名到公开记录。
- 正常房间状态当前只保存在服务端内存中；重启服务后房间消失。
- 卡图来源为 Scryfall，不提交批量卡图、缓存、`dist`、`node_modules` 或 `tools/*.exe`。
- Windows PowerShell 脚本优先使用 ASCII 提示文字，避免 Windows PowerShell 5 的无 BOM UTF-8 解析问题。
- 保持中英文界面字典同步；卡名、聊天和玩家输入不自动翻译。

## Git 约定

- 只提交当前任务产生且已验证的文件，不包含构建产物或来源不明的改动。
- 阶段提交信息使用简体中文，准确概括产出。
- 不改写历史，不执行破坏性 Git 命令，不自动推送远端。

## 辅助规则与视觉

- `src/server/rules.ts` 是确定性白名单规则模块；未知牌和不支持的战场组合必须拒绝自动处理。
- `tests/rules.test.ts` 检查规则状态变化和失败原子性；`tests/server.test.ts` 使用独立端口验证双客户端隐藏信息与结算。
- `src/client/arena.css`、`ArenaHud.tsx`、`RulesPanel.tsx` 提供竞技场外观与辅助操作；原创背景位于 `public/art/arena-background.png`。
- 服务端端口可由 `PORT` 指定，默认 8787；开发前端仍连接 8787。
- Python Oracle 编译器尚未接入，不得宣称可自动执行任意 Oracle 文本。
