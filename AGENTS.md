# MTG Tabletop 项目协作说明

## 项目定位

MTG Tabletop 是面向朋友娱乐对局的双人网页牌桌，不是完整万智牌规则引擎。费用、出地限制、目标和结算由玩家裁定，程序只同步手动操作。

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

## 视觉与验证

- `src/client/arena.css`、`ArenaHud.tsx` 提供竞技场外观；原创背景位于 `public/art/arena-background.png`。
- `tests/server.test.ts` 使用独立端口验证双客户端隐藏信息、手动移牌和生命操作。
- 服务端端口可由 `PORT` 指定，默认 8787；开发前端仍连接 8787。
- 手动房间保持玩家裁定；新增自动房间以 Forge 为权威状态源，不重建简化白名单规则引擎。
- Forge 方案与状态见 `docs/Forge接入与三维客户端方案.md`；未完成真实引擎集成测试前不得宣称已接入。
