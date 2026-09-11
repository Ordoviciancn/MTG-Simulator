# MTG Tabletop 项目协作说明

## 项目定位

目标是高度忠实复现 MTGA 对局内体验的双人客户端，采用 Forge 无头规则核心 + Java Bridge + Node 房间服务 + React/WebGL 表现层。当前可运行界面仍是旧手动牌桌，不代表目标已实现。允许重写全部旧架构；旧代码仅作为可测试的迁移基线。

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

- `src/client/arena.css`、`ArenaHud.tsx` 提供竞技场外观；纸雕场景背景位于 `public/art/storybook-arena.png`。
- `roomEffects.ts` 从可见房间快照生成视觉事件，`useRoomEffects.ts` 管理独立到期的动画队列；动画不得修改规则状态或推断敌方私密牌名。录屏交互依据见 `docs/录屏交互观察.md`。
- `tests/server.test.ts` 使用独立端口验证双客户端隐藏信息、手动移牌和生命操作。
- 服务端端口可由 `PORT` 指定，默认 8787；开发前端仍连接 8787。
- 新实现由 Forge 独占全部规则状态；Node 与客户端不得维护第二套规则。旧手动房间在新闭环通过验收后移除，不再作为最终产品要求。
- 新动画只能由经可见性裁剪的语义事件驱动；快照用于同步和落位，不用于推测规则事件。
- Forge 方案与状态见 `docs/Forge接入与三维客户端方案.md`；未完成真实引擎集成测试前不得宣称已接入。
- 实施规划与阶段验收见 `docs/superpowers/plans/2026-09-11-Forge自动对局与竞技场交互规划.md`；真人 Match 验证优先于扩大美术范围。
- 全面重构范围与模块处置以 `docs/全面重构审计与差距矩阵.md` 为准，其替代旧规划中保留手动房间的最终产品要求。

- Forge 核心构建使用 `scripts/构建Forge核心.ps1 -JdkHome <JDK目录>`；通过 reactor 执行 forge-ai 及依赖的测试、打包和运行时 classpath 导出。源码、Maven、依赖缓存和产物均留在忽略目录 `.local-tools/`。

- `pnpm forge:probe` 需要 JAVA_HOME 和已构建的 Forge，验证 Node/Java 进程及最小 Game 状态，不等同于完整对局或网页接入；相关变更需运行该验证。
- `pnpm forge:human-smoke` 需要 JAVA_HOME 和 forge-gui 构建，验证双 Human Match 到达选择窗口与双座位视图；输出 `fullGameVerified:false`，不能作为完整对局验收。Java 用户目录与 APPDATA/LOCALAPPDATA 必须隔离到会话目录，退出后等待进程关闭再清理。
