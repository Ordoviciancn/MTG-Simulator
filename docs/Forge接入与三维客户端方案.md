# Forge 接入与三维客户端方案

## 当前状态

目前只完成源码接口核对、版本记录和环境检查脚本，尚未编译或接通 Forge；现有房间仍运行手动牌桌。参考视频未能读取，以下动画为待验证的设计，不是逐帧复刻结果。

上游：https://github.com/Card-Forge/forge 。本次核对 HEAD 为 `c86308451651af63c1b4a69a2c47f9cd478d53f6`，记录于 `config/forge-source.json`。构建要求来自上游 pom.xml：Java 17，Maven >= 3.8.1。Forge 仓库标注 GPL-3.0；引入、修改与分发上游代码须保留许可证及对应源码安排，不因独立进程就假定免除义务。

## 技术选择

优先在现有 React/TypeScript 客户端中引入 Three.js 三维战场，保留网页联机、牌表导入及工具面板。相较立刻重写 Unity 客户端，这一路径需要迁移的现有功能更少；是否达到最终视觉目标需以真实场景帧时间和美术样片验证。

Unity + URP 是需要独立桌面客户端、重度三维场景和编辑器美术流程时的备选。两条路线都通过相同协议连接 Java 进程，不把 Java 引擎移植成 C#。暂不要求安装 Unity。

## 权威状态与玩家选择

Forge 独立 Java 进程拥有自动房间的全部规则状态；Node 服务管理连接、房间与玩家身份。手动房间保持现有逻辑，自动房间不能调用手动 moveCard 或 setLife 改写规则状态。

已核对的上游接口：

- `forge-game/.../Game.java`：创建对局、访问 GameView，使用 subscribeToEvents 订阅已发生事件。
- `forge-game/.../player/PlayerController.java`：包含费用支付、目标/模式选择、攻防宣告、调度、替代效应等交互点；不能只适配施放和结算两个按钮。
- `forge-game/.../event/`：事件输出供界面、日志和动画使用。现有类不能直接完整序列化给客户端，须按玩家可见性转换。

设计中的桥接协议是本项目新增协议，不是声称 Forge 已有 HTTP API。命令携带 matchId、requestId、状态版本和服务器绑定的玩家身份；玩家选择携带引擎发出的 promptId 与合法选项 ID。重复请求不重复支付，过期选择拒绝并刷新状态。未知选择类型明确中断并报告，不默认替玩家选第一项。

游戏线程负责串行推进。浏览器等待玩家选择时，Java 对局暂停而不是阻塞 Node 服务。每个玩家分别生成脱敏视图；公开事件不可带入对手手牌名、牌库顺序和未公开目标信息。重连先恢复快照与待选问题，不重播已完成费用或伤害。

## 动画层

由引擎事件驱动动画队列，界面动画完成与否不决定规则结果。抽牌沿牌库到手牌轨迹移动，未知卡只显示牌背；施放从手牌进入堆叠，目标线连接已公开目标；结算、伤害与区域移动依事件顺序呈现。战斗涉及攻击宣告、阻挡关系、接触反馈与伤害数字。

卡牌保持完整尺寸与比例，横置仅旋转。场景使用原创竞技场、灯光、粒子、材质和音效；按参考视频分析节奏和布局，不把视频截图当可交互界面。提供减少动画、跳过积压动画及重连直接落位的路径。

## 实施验收顺序

1. 安装 JDK 17 和 Maven 3.9.x，执行 `powershell -File scripts/检查Forge环境.ps1`，再核对版本。
2. 获取固定版本上游，在隔离目录编译 forge-game 及依赖，启动最小真实对局；记录资源加载与运行依赖。
3. 适配玩家选择与视图：双客户端完成调度、费用、响应、结算、攻击和阻挡，核验隐藏信息、过期请求与重连。
4. 接入事件驱动的三维演示场景，先完成一条真实施放—响应—结算链，再扩展美术和战斗特效。
5. 依据可访问的视频逐段整理镜头、时序与动效差异，运行两客户端完整对局和性能检查后开放自动房间。

当前未完成上述运行验收，不显示“Forge 已连接”或“完整自动结算”等状态。

参考：
- https://github.com/Card-Forge/forge/blob/master/pom.xml
- https://github.com/Card-Forge/forge/blob/master/forge-game/src/main/java/forge/game/player/PlayerController.java
- https://github.com/Card-Forge/forge/blob/master/forge-game/src/main/java/forge/game/Game.java
- https://threejs.org/
- https://docs.unity3d.com/Manual/urp/urp-introduction.html
