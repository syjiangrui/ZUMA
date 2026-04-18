# Zuma HTML 原型技术文档

## 1. 文档目的

这份文档描述当前祖马原型的真实实现结构，而不是理想化设计稿。目标是解决两个问题：

1. 当 `main.js` 已经接近 2000 行时，后续开发者需要快速理解“系统是怎么跑起来的”。
2. 后续做 Phase 2/3/4 的功能时，需要知道哪些是稳定规则层，哪些只是表现层和手感层。

当前实现特点：

- 使用单文件 `main.js` 承载全部游戏逻辑与渲染逻辑
- 使用 `Canvas 2D` 绘制轨道、球体、HUD 和场景
- 使用固定逻辑分辨率 `430 x 932`
- 支持桌面和手机触控输入
- 核心玩法已经具备：发射、插入、三消、断链、重新并链、计分、连击、基础胜负

这份文档对应当前项目中的以下文件：

- [main.js](C:/Users/reikjiang/Desktop/game/main.js)
- [ZUMA_PLAN.md](C:/Users/reikjiang/Desktop/game/ZUMA_PLAN.md)

## 2. 当前代码组织方式

虽然代码目前仍在一个文件中，但逻辑上已经自然分成了 8 个子系统：

1. 基础配置与常量
2. 运行时状态与回合生命周期
3. 输入与 UI 交互
4. 路径与几何计算
5. 球链推进、插入、断链、并链
6. 消除、连锁、计分
7. 渲染
8. 工具函数与纹理生成

单文件的优点：

- 修改快
- 调试链路完整
- 原型阶段不需要跨文件跳转

单文件的代价：

- 状态耦合逐步升高
- 断链与计分逻辑已经明显不适合继续“自然生长”
- 新成员读代码成本较高

结论：

当前实现已经不再是“简单原型脚本”，而是一个逻辑上可拆分、但物理上尚未拆分的游戏系统。

## 3. 运行时总览

系统入口是 `new ZumaGame(canvas)`。

构造阶段做的事情：

1. 绑定 canvas 与 2D context
2. 初始化所有运行时状态
3. 生成轨道路径
4. 生成球体纹理
5. 重置一局游戏
6. 绑定输入事件
7. 调整画布尺寸
8. 启动 `requestAnimationFrame`

可以把整个系统理解成这条主线：

`constructor -> loop -> update -> render`

其中：

- `update()` 负责逻辑推进
- `render()` 负责把当前状态绘制出来
- 绝大多数“动画”并不是单独存在的对象，而是通过状态值随时间变化自然形成

## 4. 核心状态模型

### 4.1 全局状态

`ZumaGame` 实例中最关键的状态字段如下：

| 字段 | 含义 |
| --- | --- |
| `pathPoints` | 预采样后的轨道点集，包含累计弧长 |
| `totalPathLength` | 整条路径总长度 |
| `chain` | 当前轨道上的球链数组 |
| `chainHeadS` | 球链共享基准位置 |
| `splitState` | 中段消除后的断链状态 |
| `projectile` | 当前飞行中的发射球 |
| `pendingMatchChecks` | 延迟执行的匹配检查队列 |
| `gameState` | `playing / win / lose` |
| `score` | 当前分数 |
| `actionContexts` | 一次发射对应的事件上下文表 |
| `matchFeedback` | 顶部浮动计分反馈 |
| `recentCombo` | 最近一次连击反馈 |
| `bestCombo` | 本局最高连击 |
| `mergeSettle` | 并链后的极短收口缓冲 |
| `pointer` | 当前指针逻辑坐标与按下状态 |
| `shooter` | 发射器位置与角度 |

### 4.2 轨道球对象

每个球链元素由 `createChainBall()` 创建，当前字段为：

| 字段 | 含义 |
| --- | --- |
| `id` | 球的稳定唯一标识，用于延迟匹配 |
| `paletteIndex` | 颜色/纹理索引 |
| `radius` | 球半径 |
| `s` | 当前沿路径的距离 |
| `rotation` | 贴图滚动角度 |
| `offset` | 临时位移修正 |
| `offsetMode` | `idle / insert / close` |
| `impact` | 短时视觉冲击强度 |
| `lastActionId` | 最近一次所属的发射动作 |

这里最重要的是：

球本身不保存“屏幕速度”或“路径速度”。  
轨道球的可见位置统一通过下面这个公式得出：

```text
ball.s = chainHeadS - index * BALL_SPACING + offset + splitOffset
```

这也是当前代码架构最核心的设计。

### 4.3 splitState

`splitState` 表示球链被中段消除后，当前被分成前后两段。

当前字段：

| 字段 | 含义 |
| --- | --- |
| `index` | 断口右侧第一颗球在 `chain` 中的索引 |
| `frontPull` | 前链整体回拉的当前动画值 |
| `initialGap` | 断链刚形成时的原始断口大小 |
| `actionId` | 这次断链所属的发射动作 |

它不是一个“第二条链对象”，而是现有球链上的一个临时断口描述。

### 4.4 projectile

飞行球和轨道球是两套完全不同的坐标模型：

- 轨道球：用路径距离 `s`
- 飞行球：用 `x / y / vx / vy`

这是必要的，因为发射阶段不属于轨道约束运动。

### 4.5 action context

计分和连击不是从球链长度差推导出来，而是基于“一次发射动作”。

每次发射会创建一个 `actionContext`：

| 字段 | 含义 |
| --- | --- |
| `id` | 动作 id |
| `source` | 来源，通常是 `shot` |
| `combo` | 当前动作已触发的消除轮次 |
| `totalRemoved` | 当前动作累计消除球数 |
| `totalScore` | 当前动作累计分数 |

这使得：

- 首消
- 接缝重新接合后的二次消除
- 后续连锁消除

都能归属于同一次发射。

## 5. 主循环与执行顺序

主循环在 `loop()` 中完成。

每帧流程：

1. 计算 `dt`
2. 执行 `update(dt)`
3. 执行 `render()`
4. 请求下一帧

### 5.1 update 顺序

`update()` 当前顺序非常关键：

1. `updateHudState(dt)`
2. 如果不是 `playing`，直接返回
3. `updateAim(dt)`
4. `updateChain(dt)`
5. 如果状态已经结束，再返回
6. `updateProjectile(dt)`
7. `updateRoundOutcome()`

这个顺序的意义：

- 先更新瞄准，保证发射器方向总是最新
- 先更新链条，再更新飞行球，保证碰撞判定基于最新球链位置
- 最后才结算胜负，避免同一帧内出现中间态误判

### 5.2 为什么 `dt` 被限制到 `0.033`

这是为了避免低帧率或切后台回来时，单帧时间过长导致：

- 球链跳跃
- 飞行球穿透
- 断链并链错过阈值

它相当于一个简单的“最大步长保护”。

## 6. 路径系统

### 6.1 路径定义

当前路径由 `createPath()` 中的一组控制点定义，使用 `Catmull-Rom` 插值平滑后，再重新采样为离散路径点。

这套实现分成两步：

1. 从控制点插值得到足够密的采样点
2. 为每个采样点计算累计弧长 `len`

最终 `pathPoints` 中每个元素结构为：

```js
{ x, y, len }
```

### 6.2 为什么要做弧长采样

因为祖马需要“按路径距离匀速前进”，不是按参数 `t` 匀速前进。

如果直接按曲线参数推进，会出现：

- 弯道快慢不均
- 路径不同段速度看起来不一致

所以当前实现只允许逻辑层处理 `s`，再通过 `getPointAtDistance()` 映射到屏幕坐标。

### 6.3 相关工具函数

- `getPointAtDistance(s)`：路径距离转屏幕坐标
- `getClosestPathDistance(x, y)`：屏幕坐标反查路径距离
- `catmullRom(...)`：插值函数

## 7. 输入与 UI 结构

### 7.1 输入模型

当前输入全部基于 `Pointer Events`：

- `pointerdown`
- `pointermove`
- `pointerup`
- `pointercancel`
- `pointerleave`

这让鼠标和触屏可以共用一套逻辑。

当前操作模型是：

- 按下后拖动瞄准
- 松开发射

此外保留了桌面快捷键：

- `Space` 发射
- `R` 重开

### 7.2 为什么 UI 命中要先于玩法输入

`getUiActionAt()` 会先判断指针是否命中了 HUD 按钮或结束面板按钮。  
这是为了避免手机端点击“重开”时，被同时当成一次瞄准/发射。

### 7.3 UI 布局

当前可交互 UI 包括：

- HUD 重开按钮
- HUD 下一球预览
- 结束卡片
- 结束卡片中的重开按钮

这些都直接绘制在 canvas 内部，而不是 HTML DOM 按钮。

## 8. 生命周期与回合状态

### 8.1 gameState

当前回合只有 3 个状态：

- `playing`
- `win`
- `lose`

`setGameState()` 是唯一入口。

它的职责：

- 切换回合状态
- 在离开 `playing` 时禁用发射球和拖动输入

### 8.2 resetRound()

`resetRound()` 是唯一的整局重置入口，会清理：

- 发射球
- 断链状态
- 延迟匹配队列
- 球 id 分配
- action context
- HUD 反馈
- 分数 / 连击
- 当前球 / 下一球颜色
- 发射器朝向
- 指针状态

这保证“一次重开”和“新建一局”走的是同一条路径。

### 8.3 胜负条件

失败：

- 球链尾部超过 `totalPathLength + EXIT_GAP`

胜利：

- `chain.length === 0`
- 没有飞行球
- 没有待处理匹配检查

这个条件设计是对的，因为它避免了“最后一组球刚消失，但空中还有球或待判定连锁”时的误判。

## 9. 球链推进模型

### 9.1 基础推进

在未断链时，整条链通过 `chainHeadS += CHAIN_SPEED * dt * speedScale` 推进。

这里的 `speedScale` 当前只用于并链后的极短 `mergeSettle` 缓冲。

### 9.2 offset 的职责

`offset` 是临时位移，不是永久位置。

它用来表达：

- 插入时的让位
- 消除后的补位
- 并链后残余收口

### 9.3 offsetMode 的职责

`offsetMode` 只决定“offset 回到 0 的速度规则”。

当前有 3 种：

- `idle`
- `insert`
- `close`

其中：

- `insert` 用 `INSERT_SETTLE_SPEED`
- `close` 在普通补位时用 `GAP_CLOSE_SPEED`
- `close` 在断链后后半段追赶时用 `SPLIT_CLOSE_SPEED`

这是一种很实用的折中方案：

规则状态仍然简单，但不同手感来源已经被区分开。

## 10. 发射与插入

### 10.1 发射球

`fireProjectile()` 创建飞行球，字段包括：

- `x / y`
- `vx / vy`
- `radius`
- `paletteIndex`
- `actionId`
- `rotation`
- `spin`

发射后：

- 当前球颜色切换到下一球
- 重新随机生成下一球颜色

### 10.2 碰撞检测

`findChainCollision()` 当前使用“飞行球与链上每颗球的最近距离”做命中判断。

这是第一版够用的方案，优点是：

- 简单
- 稳定
- 易调试

代价是：

- 不是严格的路径切入判定
- 对复杂插入角度的真实性有限

### 10.3 插入

`insertProjectile()` 负责把飞行球转换成轨道球。

插入流程：

1. 根据 `projectileS` 与 `hitS` 判断插到命中球前还是后
2. 创建新轨道球
3. 给新球一个 `insertionOffset`
4. 如果插入点在断口前，要修正 `splitState.index`
5. 插入球链数组
6. 调用 `applyInsertSpacingWave()` 打开局部空位
7. 添加视觉冲击
8. 延迟加入一次匹配检查

### 10.4 插入动画为什么不是独立状态机

当前没有为“待并入球”引入额外对象，而是保留单阶段插入模型：

- 新球立刻进入球链
- 但通过 `offset + spacing wave` 模拟局部让位

这是当前项目的一个重要取舍：

- 逻辑简单
- 稳定性更高
- 观感不如真正的两阶段插入精细

## 11. 消除、断链与重新并链

### 11.1 延迟匹配

插入和并链后，不会当帧立即消除，而是通过 `pendingMatchChecks` 延迟判定。

延迟队列元素大致包含：

- `ballId`
- `delay`
- `actionId`
- `trigger`

这里坚持用 `ballId` 而不是数组索引，是为了避免等待期间球链重排导致错判。

### 11.2 resolveMatchesFrom()

这是当前玩法层最关键的函数之一。

职责：

1. 从一个种子球向左右扩展同色区间
2. 检查区间是否达到 3 个以上
3. 记录一次 match 事件
4. 从球链中删除该区间
5. 为删除区间后方的球设置负向 `offset`
6. 判断这是普通闭合，还是创建一个新的断链
7. 在合适时机为接缝再安排一次延迟匹配

### 11.3 hasGapBetween()

当前原型只允许存在一个真实断口。

因此“左右球是否相邻”不是仅看数组索引，而是还要看：

- 这对索引是否正好跨过 `splitState.index`

这条规则是当前断链连锁正确性的关键。

### 11.4 创建断链

当中段消除发生，且删除区间两侧仍有球时，会创建 `splitState`。

此时：

- 前半段停住
- 后半段继续通过 `close offset` 前追
- 匹配搜索不能跨越断口
- 断口原始大小记录到 `initialGap`

### 11.5 前链回拉

当前版本的前链回拉不再只在最后几像素才发生，而是按整个断口闭合进度累计：

```text
closedDistance = initialGap - currentGap
frontPullTarget = min(maxPull, closedDistance * ratio)
```

然后再通过 `getSplitLocalOffset(index)` 分配到整段前链上：

- 接缝附近位移最大
- 远端位移较小
- 但不会完全为 0

这使得视觉上更接近“整段前链被吸回来”，而不只是最后一颗球单独抽动。

### 11.6 为什么前链回拉和并链要分开处理

如果直接在前链开始回拉时就把断口判定为闭合，会出现两个问题：

1. 前链还没来得及明显回拉，就已经并链
2. 玩家会感觉后半段吃掉了大部分距离

所以现在 `resolveSplitClosure()` 会等到：

- 后半段真正追到“动画后的前链接缝位置”

才允许并链。

### 11.7 absorbSplitState()

这是当前断链架构里最关键也最不直观的函数。

它的作用不是“清状态”那么简单，而是把断链结束时的可见姿态转移回常规链条模型。

当前做法：

1. 取接缝位置的前链局部回拉量
2. 把它吸收到 `chainHeadS`
3. 把其余的局部差异吸收到每颗球自己的 `offset`
4. 清空 `splitState`

这样做的意义：

- 避免并链瞬间前链向前跳
- 避免并链后短时间整体速度失真得太明显
- 让断链模型平滑地回到普通链条模型

### 11.8 mergeSettle

并链后还有一个极短的 `mergeSettle` 窗口。

它不是新的玩法状态，只是表现层收口：

- 短时间压低 `chainHeadS` 推进速度
- 让接缝“落一下”
- 配合局部 impact，让接触更像祖马

它的目标不是制造回弹，而是避免“刚合上就立刻满速继续”。

## 12. 连锁与计分系统

### 12.1 为什么计分不从 chain.length 推导

因为当前玩法里，一个玩家动作可能引发：

- 首消
- 断链
- 重新并链
- 接缝二次连锁

如果只看 `chain.length`，无法正确回答：

- 这次消除属于哪一发球
- 这是第几轮连锁
- 是否是接缝连锁

### 12.2 recordMatchEvent()

每次消除会更新对应 `actionContext`：

- `combo += 1`
- `totalRemoved += removedCount`
- `totalScore += awardedScore`

当前得分构成：

- 基础分：`removedCount * 100`
- 大组奖励：`(removedCount - 3) * 40`
- 连击奖励：`(combo - 1) * 120`
- 接缝奖励：`trigger === "seam" ? 90 : 0`

### 12.3 HUD 反馈

当前反馈分成两层：

- `matchFeedback`：短时浮层
- `recentCombo / bestCombo`：更长时间的 HUD 展示

这两层分离是必要的，因为短时浮层消失太快，玩家会误以为系统没记录连击。

## 13. 渲染架构

### 13.1 render() 顺序

当前绘制顺序：

1. 清空画布
2. 背景
3. 轨道
4. 终点
5. 球链
6. 发射球
7. 瞄准辅助
8. 发射器
9. 顶部 HUD
10. 结束卡片
11. 匹配反馈

这个顺序保证：

- 轨道总是在球链下方
- HUD 总在场景最上层
- 结束卡片能盖住游戏画面

### 13.2 球体绘制

`drawBall()` 会基于：

- 预生成纹理
- 当前旋转角
- 当前 impact 强度

来绘制球体。

球的“滚动感”来自：

```text
rotation = s / radius
```

这不是严格物理模拟，但在 2D 里足够形成可信的滚动视觉。

### 13.3 纹理生成

当前球体纹理并不是外部图片资源，而是 `createBallPatternCanvas()` 动态生成。

优点：

- 不依赖资源文件
- 颜色方案统一
- 调整球半径时更方便

代价：

- 美术上限有限
- 纹理风格更偏程序化

## 14. 手机端适配思路

当前移动端适配有几条明确原则：

1. 所有逻辑基于固定分辨率
2. canvas 通过 CSS/设备像素比缩放
3. 所有按钮都在 canvas 内部统一坐标系中绘制和命中
4. 输入层统一用 pointer events
5. UI 点击命中优先于玩法输入

这套方案的优点是：

- 不需要写一套 DOM HUD 再做坐标同步
- 手机和桌面行为更一致

## 15. 目前的稳定边界

当前可以认为较稳定的部分：

- 路径弧长采样模型
- 轨道球使用 `s + offset + splitOffset` 的位置模型
- `gameState` 生命周期
- action context 计分模型
- 延迟匹配检查
- 单断口 `splitState` 模型

当前仍然属于高频调试区的部分：

- 插入动画手感
- 断链后前后链分担比例
- 接缝闭合时机
- 并链后的视觉冲击强度

## 16. 当前技术债

### 16.1 单文件过大

虽然逻辑已经分层，但物理上仍在一个文件中。

建议后续拆分为：

- `config.js`：常量和颜色表
- `path.js`：路径采样和几何查询
- `round-state.js`：回合状态与 reset
- `chain-system.js`：链条推进、插入、断链、并链
- `score-system.js`：action context、计分、连击
- `render.js`：所有绘制函数
- `input.js`：pointer / keyboard / HUD hit test

### 16.2 轨道球和表现层仍有耦合

`impact`、`mergeSettle`、`offsetMode` 都已经兼具“手感”和“规则边缘”的角色。

如果后续继续加特殊球、减速效果、暂停等，建议把：

- 规则状态
- 动画状态
- HUD 状态

做进一步分离。

### 16.3 当前仍限制为单断口

当前实现只允许存在一个 `splitState`。  
对当前玩法足够，但如果以后加入更复杂的特殊球或多段同时消除，这会成为限制。

## 17. 推荐后续维护策略

在当前阶段，最合理的维护方式不是立刻大拆文件，而是：

1. 保持现有逻辑不乱动
2. 所有新增功能先写进 `PLAN`
3. 只在某个子系统明显稳定后再抽模块
4. 先补技术文档和注释，再做结构迁移

换句话说，当前更适合“文档化单体”，而不是“仓促重构”。

## 18. 建议的下一步重构切口

如果后面决定开始拆文件，推荐从以下切口开始：

### 切口 1：路径与几何

优先拆：

- `createPath`
- `getPointAtDistance`
- `getClosestPathDistance`
- `catmullRom`

原因：

- 纯函数多
- 对玩法规则依赖较少
- 拆出风险最低

### 切口 2：计分与事件流

优先拆：

- `createActionContext`
- `getActionContext`
- `trimActionContexts`
- `recordMatchEvent`
- HUD 的 combo/score 状态

原因：

- 已经有比较清晰的职责边界
- 和渲染关系相对弱

### 切口 3：断链系统

最后再拆：

- `splitState`
- `getSplitGap`
- `getSplitFrontPullTarget`
- `updateSplitFrontPull`
- `resolveSplitClosure`
- `absorbSplitState`
- `triggerMergeSettle`

原因：

- 这是当前最脆弱、最依赖上下文的部分
- 现在先保持在一起更安全

## 19. 总结

当前这版祖马原型，底层不是“每颗球自己运动”，而是：

- 用 `chainHeadS` 描述整条链的基准推进
- 用 `offset` 描述插入/补位/并链过渡
- 用 `splitState` 描述唯一断口
- 用 `pendingMatchChecks` 负责延迟判定
- 用 `actionContexts` 负责把一发球引出的所有后续事件串起来

如果只记住一句话，可以记住这个：

**当前系统的核心不是碰撞本身，而是“路径距离 + 临时位移 + 单断口状态机”。**

这也是后续继续扩展这个项目时最不能轻易破坏的基础。
