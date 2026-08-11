# MTG Tabletop 介绍视频自动录制工具 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不修改正式产品源码的前提下，建立一个可整体删除、全程自动驱动两个真实浏览器玩家并供录屏使用的介绍视频工具。

**Architecture:** `video-demo` 是独立 Node.js 工具包，使用 `playwright-core` 控制我方可见窗口与对手后台窗口，通过现有 UI 和 WebSocket 完成真实操作。场景、动作执行器、浏览器生命周期、光标覆盖层和字幕覆盖层彼此独立；正式 `src`、根 `package.json` 与生产构建不引入演示代码。

**Tech Stack:** Node.js 22、Playwright Core、浏览器原生 DOM/CSS、Node.js `node:test`、现有 React/Vite/Express/WebSocket 应用。

## Global Constraints

- 所有录制工具代码必须位于 `video-demo/`。
- 不修改 `src/client`、`src/server`、`src/shared`、根 `package.json` 或生产构建入口。
- 只显示我方青绿色虚拟光标；对手操作不显示光标。
- 两名玩家必须通过真实房间和 WebSocket 同步。
- 默认录制窗口为 1920×1080，正常速度目标约 8 分钟。
- 从倒计时开始到结束画面不需要人工推进。
- 删除 `video-demo/` 后不得留下运行依赖或产品入口。
- Windows 启动脚本提示使用 ASCII，避免 Windows PowerShell 5 编码问题。

## File Map

- Create: `video-demo/package.json` — 独立依赖与测试命令。
- Create: `video-demo/start-demo.cmd` — Windows 双击入口。
- Create: `video-demo/start-demo.ps1` — 环境检查、构建、服务生命周期和脚本启动。
- Create: `video-demo/run-demo.mjs` — 双浏览器上下文、房间流程和错误收尾。
- Create: `video-demo/lib/browser.mjs` — 浏览器探测与服务健康检查。
- Create: `video-demo/lib/runner.mjs` — 动作执行、等待、字幕和光标协调。
- Create: `video-demo/scenario.mjs` — 固定章节、牌表与动作定义。
- Create: `video-demo/overlays/cursor-overlay.js` — 我方虚拟光标反馈。
- Create: `video-demo/overlays/subtitle-overlay.js` — 字幕、倒计时和结束画面。
- Create: `video-demo/decks/player-a.txt` — 我方牌表。
- Create: `video-demo/decks/player-b.txt` — 对手牌表。
- Create: `video-demo/tests/*.test.mjs` — 浏览器、执行器、覆盖层和场景测试。
- Create: `video-demo/README.md` — 录屏运行与删除说明。
- Modify: `README.md` — 仅增加独立录制工具入口和非产品说明。

---

### Task 1: 独立工具包与 Windows 启动生命周期

**Files:**
- Create: `video-demo/package.json`
- Create: `video-demo/start-demo.cmd`
- Create: `video-demo/start-demo.ps1`
- Create: `video-demo/lib/browser.mjs`
- Test: `video-demo/tests/browser.test.mjs`

**Interfaces:**
- Produces: `findBrowserExecutable(env, exists): string | null`
- Produces: `waitForHealth(url, options): Promise<void>`
- Produces: `launchDemoBrowser(options): Promise<Browser>`
- Consumes: 根项目命令 `pnpm build` 与 `pnpm start`

- [ ] **Step 1: 写浏览器探测与健康检查失败测试**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { findBrowserExecutable, waitForHealth } from "../lib/browser.mjs";

test("prefers an explicit browser path", () => {
  const found = findBrowserExecutable({ DEMO_BROWSER_PATH: "C:/Chrome/chrome.exe" }, (file) => file === "C:/Chrome/chrome.exe");
  assert.equal(found, "C:/Chrome/chrome.exe");
});

test("health wait reports the requested URL", async () => {
  await assert.rejects(
    waitForHealth("http://127.0.0.1:9/health", { timeoutMs: 20, fetchImpl: async () => { throw new Error("offline"); } }),
    /127\.0\.0\.1:9\/health/,
  );
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd video-demo; node --test tests/browser.test.mjs`

Expected: FAIL，提示 `lib/browser.mjs` 不存在。

- [ ] **Step 3: 建立独立依赖与浏览器工具**

`video-demo/package.json`：

```json
{
  "name": "mtg-tabletop-video-demo",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test tests/*.test.mjs", "demo": "node run-demo.mjs" },
  "dependencies": { "playwright-core": "^1.54.0" }
}
```

`browser.mjs` 探测 `DEMO_BROWSER_PATH`、Chrome 和 Edge 常见 Windows 路径；`waitForHealth` 每 250ms 请求 `/health`，默认 30 秒超时；浏览器启动必须使用临时 context，不连接用户现有 Chrome 配置。

- [ ] **Step 4: 编写全自动 Windows 启动脚本**

`start-demo.cmd` 只调用同目录 PowerShell 文件。`start-demo.ps1` 必须定位项目根、探测 Node/pnpm、首次安装 `video-demo` 依赖、执行根项目构建、后台启动 `pnpm start`、等待健康检查、运行正常速度演示，并在 `finally` 中只终止自身启动的进程。

- [ ] **Step 5: 运行测试与脚本语法检查**

Run: `cd video-demo; pnpm install; pnpm test`

Expected: 2 tests PASS。

Run: `[void][scriptblock]::Create((Get-Content video-demo/start-demo.ps1 -Raw))`

Expected: 无语法异常。

- [ ] **Step 6: 提交阶段成果**

```powershell
git add video-demo/package.json video-demo/start-demo.cmd video-demo/start-demo.ps1 video-demo/lib/browser.mjs video-demo/tests/browser.test.mjs video-demo/pnpm-lock.yaml
git commit -m "建立视频录制工具启动框架"
```

---

### Task 2: 虚拟光标与字幕覆盖层

**Files:**
- Create: `video-demo/overlays/cursor-overlay.js`
- Create: `video-demo/overlays/subtitle-overlay.js`
- Test: `video-demo/tests/overlays.test.mjs`

**Interfaces:**
- Produces: `window.__mtgDemoCursor.moveTo(rect, durationMs)`
- Produces: `window.__mtgDemoCursor.click(kind)`，kind 为 `left | right`
- Produces: `window.__mtgDemoCursor.setDragging(value)`
- Produces: `window.__mtgDemoSubtitle.show(text, kind, durationMs)`
- Produces: `window.__mtgDemoSubtitle.countdown(seconds)`
- Produces: `window.__mtgDemoSubtitle.finish(lines)`

- [ ] **Step 1: 写覆盖层契约测试**

```js
test("cursor overlay exposes the recording API", () => {
  const source = readFileSync(new URL("../overlays/cursor-overlay.js", import.meta.url), "utf8");
  assert.match(source, /window\.__mtgDemoCursor/);
  assert.match(source, /pointer-events:\s*none/);
  assert.doesNotMatch(source, /style\.(left|top)\s*=/);
});
```

字幕测试断言唯一 DOM ID、`self/opponent/system` 三类和结束卡 API。

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd video-demo; node --test tests/overlays.test.mjs`

Expected: FAIL，提示覆盖层文件不存在。

- [ ] **Step 3: 实现光标覆盖层**

注入 `#mtg-demo-cursor-layer`、青绿色指针、“我方”标签、左键单环、右键双环、抓取态和“横置”提示。坐标使用 CSS 变量和 `translate3d`，覆盖层必须 `pointer-events: none`。

- [ ] **Step 4: 实现字幕覆盖层**

注入 `#mtg-demo-subtitle-layer`，支持动作字幕、三秒倒计时、章节标题和结束卡。结束卡显示项目名、GitHub 地址和非官方免责声明。

- [ ] **Step 5: 运行测试并提交**

Run: `cd video-demo; pnpm test`

Expected: 全部 PASS。

```powershell
git add video-demo/overlays video-demo/tests/overlays.test.mjs
git commit -m "实现录制光标与字幕覆盖层"
```

---

### Task 3: 场景协议与动作执行器

**Files:**
- Create: `video-demo/lib/runner.mjs`
- Test: `video-demo/tests/runner.test.mjs`

**Interfaces:**
- Produces: `createRunner({ viewerPage, opponentPage, speed, logger })`
- Produces actions: `subtitle`, `click`, `rightClick`, `fill`, `drag`, `waitFor`, `pause`, `opponentHighlight`, `closePage`, `reopenOpponent`, `finish`
- Consumes: Task 2 的页面覆盖层 API

- [ ] **Step 1: 写动作顺序、倍速与错误上下文测试**

使用 fake page/locator 验证 `pause` 等待为 `durationMs / speed`；我方 click 先移动光标再点击；对手 click 不调用光标；错误包含章节、动作和 selector。

```js
await assert.rejects(
  runner.run([{ chapter: "堆叠", actor: "self", kind: "click", selector: ".missing", caption: "结算" }]),
  /堆叠.*结算.*\.missing/s,
);
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd video-demo; node --test tests/runner.test.mjs`

Expected: FAIL，提示 `createRunner` 未定义。

- [ ] **Step 3: 实现动作调度**

所有 UI 动作先等待 locator 可见，默认 10 秒超时。`drag` 读取起止 bounding box、播放抓取动画，再调用 `dragTo`；`rightClick` 播放双环后执行右键；`fill` 逐字输入。每个动作可带 `expect: { selector, state, text }`，不满足时立即停止。

- [ ] **Step 4: 运行测试并提交**

Run: `cd video-demo; pnpm test`

Expected: 全部 PASS。

```powershell
git add video-demo/lib/runner.mjs video-demo/tests/runner.test.mjs
git commit -m "实现自动演示动作执行器"
```

---

### Task 4: 固定牌表与完整场景定义

**Files:**
- Create: `video-demo/decks/player-a.txt`
- Create: `video-demo/decks/player-b.txt`
- Create: `video-demo/scenario.mjs`
- Test: `video-demo/tests/scenario.test.mjs`

**Interfaces:**
- Produces: `chapters: Array<{ id, title }>`
- Produces: `createScenario({ roomCode, playerNames }): DemoAction[]`
- Consumes: Task 3 动作类型

- [ ] **Step 1: 写场景完整性测试**

断言 11 个章节顺序正确；每个动作包含 `chapter/actor/kind/caption`；对手动作没有 cursor；最后动作为 finish；正常速度总等待在 430–530 秒；至少包含 click、rightClick、fill、drag、closePage 和 reopenOpponent。

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd video-demo; node --test tests/scenario.test.mjs`

Expected: FAIL，提示 `scenario.mjs` 不存在。

- [ ] **Step 3: 编写演示牌表**

我方牌表使用 `Lightning Bolt`、`Memnite`、`Colossus Hammer` 与基础地；对手牌表使用 `Counterspell`、`Spell Pierce` 与基础地。双方主牌各 60 张，空行后包含备牌。

- [ ] **Step 4: 编写完整动作清单**

动作必须覆盖：双方填写名称与牌表、获取卡图、创建/加入房间、抓七与调度、找牌、出地、右键横置、拖入 Cast、对手响应、堆叠结算、公开坟场、Memnite 与 Hammer 依附、两类牌上计数器、Token、桌面计数器、D20、看顶三张、多选、回底/送坟/盖放、私密记录、自动阶段与结束回合、换备、关闭并重连对手、结束卡。

- [ ] **Step 5: 运行测试并提交**

Run: `cd video-demo; pnpm test`

Expected: 全部 PASS。

```powershell
git add video-demo/decks video-demo/scenario.mjs video-demo/tests/scenario.test.mjs
git commit -m "编排完整自动对战演示场景"
```

---

### Task 5: 双浏览器编排与全程自动播放

**Files:**
- Create: `video-demo/run-demo.mjs`
- Modify: `video-demo/lib/browser.mjs`
- Modify: `video-demo/lib/runner.mjs`
- Test: `video-demo/tests/runner.test.mjs`

**Interfaces:**
- CLI: `node run-demo.mjs --speed <number> [--headless] [--start-chapter <id>]`
- Consumes: `launchDemoBrowser`、`createRunner`、`createScenario`

- [ ] **Step 1: 增加 CLI 与重连生命周期失败测试**

验证非法 speed 被拒绝；`--headless` 被解析；对手重开时使用原 context 与固定 `mtg-player-id`；异常时设置非零退出码并保留可见窗口。

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd video-demo; pnpm test`

Expected: 新测试 FAIL。

- [ ] **Step 3: 实现双浏览器上下文**

我方 context 使用 1920×1080 viewport 并显示；对手 context 后台运行。两边导航前分别注入固定 `mtg-player-id`，不使用用户 Chrome 配置。

- [ ] **Step 4: 实现房间码捕获与全程运行**

我方创建后从 `.connection` 提取房间码，传给后续对手加入动作。卡图按钮等待成功提示或重新启用，最长 90 秒。注入覆盖层、显示三秒倒计时、执行全部动作；成功后停留结束卡，失败时显示停止章节并打印 selector。

- [ ] **Step 5: 单元测试与快速无头验证**

Run: `cd video-demo; pnpm test`

Expected: 全部 PASS。

Run: `node video-demo/run-demo.mjs --headless --speed 20`

Expected: 两名玩家进入同一房间并执行到结束，退出码 0。

- [ ] **Step 6: 提交阶段成果**

```powershell
git add video-demo/run-demo.mjs video-demo/lib video-demo/tests
git commit -m "完成双客户端自动演示编排"
```

---

### Task 6: 使用说明、实际录制与视觉验收

**Files:**
- Create: `video-demo/README.md`
- Modify: `README.md`
- Modify only if required by verified selectors: files inside `video-demo/`

**Interfaces:**
- User entry: `video-demo/start-demo.cmd`
- Removal: delete only `video-demo/`

- [ ] **Step 1: 编写录制说明**

说明环境要求、双击启动、OBS 捕获我方窗口、1920×1080、不要操作后台窗口、失败日志、重跑和删除方式。根 README 只链接该说明，并明确录制工具不是正式功能。

- [ ] **Step 2: 运行测试与生产构建**

Run: `cd video-demo; pnpm test`

Expected: 0 failures。

Run: `pnpm build`

Expected: TypeScript 与 Vite 构建成功，正式产物不包含 `video-demo`。

- [ ] **Step 3: 完成快速浏览器验证**

Run: `node video-demo/run-demo.mjs --speed 20`

Expected: 11 章完成；终端无未处理异常；对手隐藏手牌未出现在我方画面。

- [ ] **Step 4: 完成正常速度视觉检查**

Run: `video-demo\start-demo.cmd`

逐章检查光标同步、字幕遮挡、对手无光标、卡图清晰、弹窗裁切与结束卡停留。发现的问题只能修改 `video-demo` 内脚本或覆盖层。

- [ ] **Step 5: 验证可删除边界**

Run: `git diff --name-only baa574e..HEAD`

Expected: 实现只包含 `video-demo/`、设计/计划文档、`AGENTS.md` 和 README 文档入口；不包含 `src/` 或根 `package.json`。

- [ ] **Step 6: 最终提交与状态检查**

```powershell
git add video-demo README.md
git commit -m "完善自动演示录制与使用说明"
git status -sb
```

Expected: 工作区干净，本地提交未自动推送。
