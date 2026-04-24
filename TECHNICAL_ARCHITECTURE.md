# Zuma HTML 原型技术文档

## 1. 文档目的

这份文档描述当前祖马原型的真实实现结构，而不是理想化设计稿。目标是解决两个问题：

1. 代码已拆分为 10 个 ES 模块后，后续开发者需要快速理解”系统是怎么跑起来的”。
2. 后续做 Phase 2/3/4 的功能时，需要知道哪些是稳定规则层，哪些只是表现层和手感层。

当前实现特点：

- 使用 ES 模块组织于 `src/` 目录，`main.js` 中的 `ZumaGame` 类作为编排器。渲染层进一步拆分为 `src/render/` 子模块（`draw-utils`, `ball-textures`, `scene`, `hud`, `screens`, `index`）
- 构建工具：Vite（多入口：主游戏 + `tools/path-editor/`）
- 使用 `Canvas 2D` 绘制轨道、球体、HUD 和场景
- 使用固定逻辑分辨率 `430 x 932`
- 支持桌面和手机触控输入
- 核心玩法已经具备：发射、插入、三消、断链、重新并链、计分、连击、基础胜负

这份文档对应当前项目中的以下文件：

- [src/main.js](src/main.js) — ZumaGame 编排器
- [src/config.js](src/config.js) — 常量与调色板
- [src/sfx.js](src/sfx.js) — 音频合成
- [src/path.js](src/path.js) — 路径几何（多种路径生成器 + 调度器）
- [src/chain.js](src/chain.js) — 球链 + 断链/并链
- [src/match.js](src/match.js) — 匹配检测与计分
- [src/projectile.js](src/projectile.js) — 弹射体系统
- [src/render/](src/render/) — 渲染与纹理生成（6 文件：index / draw-utils / ball-textures / scene / hud / screens）
- [src/levels.js](src/levels.js) — 8 关卡配置（路径类型、颜色数、链速等）
- [src/save.js](src/save.js) — localStorage 持久化（关卡进度）
- [ZUMA_PLAN.md](ZUMA_PLAN.md)

## 2. 当前代码组织方式

虽然代码已拆分为 10 个 ES 模块，但逻辑上仍然对应 10 个子系统：

1. 基础配置与常量
2. 运行时状态与回合生命周期
3. 输入与 UI 交互
4. 路径与几何计算（多路径类型调度）
5. 球链推进、插入、断链、并链
6. 消除、连锁、计分
7. 渲染
8. 工具函数与纹理生成
9. 关卡配置（8 关定义、路径类型、难度曲线）
10. 存档与持久化（localStorage 关卡进度）

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

路径系统已从单一螺旋轨道重构为多路径类型调度架构。`path.js` 现在包含一个调度器和多种路径生成器。

调度入口：

```js
createPath(shooterX, shooterY, pathType, pathParams) → finalizePath()
```

6 种路径生成器：

| 生成器 | pathType | 描述 |
|--------|----------|------|
| `generateSpiralPath` | `"spiral"` | 阿基米德螺旋（原始默认路径） |
| `generateSerpentinePath` | `"serpentine"` | 蛇形 S 曲线 |
| `generateRectangularPath` | `"rectangular"` | 矩形/方形折线路径 |
| `generateZigzagPath` | `"zigzag"` | 锯齿形路径 |
| `generateOpenArcPath` | `"openArc"` | 椭圆弧开环 |
| `generateBezierPath` | `"bezier"` / `"quadratic"` | 二次贝塞尔曲线链（编辑器产出，`"bezier"` 为旧别名） |
| `generateCubicBezierPath` | `"cubic"` | 三次贝塞尔曲线链（钢笔工具产出） |

`createPath()` 根据 `pathType` 参数分发到对应生成器，生成器输出控制点与 Path2D，随后 `finalizePath()` 计算累计弧长并统一产出 `pathPoints[]`。详细的贝塞尔数据格式、编辑器交互、钢笔工具参考 `docs/path-editor-and-bezier-paths.md`。

这套实现分成两步：

1. 生成器产出粗控制点
2. `finalizePath()` 对控制点做 Catmull-Rom 插值得到密采样，再为每个采样点计算累计弧长 `len`

最终 `pathPoints` 中每个元素结构为：

```js
{ x, y, len }
```

### 6.2 关卡配置如何驱动路径

路径参数从关卡配置流入：

```
levels.js (LEVELS[i].pathType, pathParams)
  → main.js loadLevel() 设置 game.levelConfig
    → createPath(shooterX, shooterY, levelConfig.pathType, levelConfig.pathParams)
```

每个关卡可以指定不同的路径类型和参数（如圈数、振幅、段数等），使 8 个关卡拥有完全不同的视觉轨道。

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

当前回合有 4 个状态：

- `levelSelect`
- `playing`
- `win`
- `lose`

`setGameState()` 是唯一入口。

它的职责：

- 切换回合状态
- 在离开 `playing` 时禁用发射球和拖动输入
- 在进入 `levelSelect` 时展示关卡选择界面

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

补充规则：

- 如果删除区间吃掉了当前**可见头球**，不能沿用普通“后方整段补位”的处理
- 这时要先基于最新 `s` 找到首颗 `0 <= s <= totalPathLength` 的球
- 若删除区间覆盖了它，则说明这次删除会改变当前屏幕上看到的链头
- 删除后要把它前面那些已经越出可玩路径的 leader balls 一并裁掉
- 再把这段裁剪量和本次删除量吸收到 `chainHeadS`
- 如果前段 `splitState.frontPull` 的分布也因此变化，还要再做一次 visible-head anchor 对齐，保证新的首颗可见球保持删除前的位置
- 只有这样，剩余可见球才会继续按正常传送带速度前进，而不会朝“删除前的满链目标位置”做一次假追赶

### 11.3 hasGapBetween()

当前原型只允许存在一个真实断口。

因此“左右球是否相邻”不是仅看数组索引，而是还要看：

- 这对索引是否正好跨过 `splitState.index`

这条规则是当前断链连锁正确性的关键。

### 11.3A 可见头消除的特殊处理

普通消除时，我们会给删除区间后方的球统一加负向 `offset`，让它们自己把空位补上。

但如果被删掉的是当前屏幕上的链头，这样做会出错：

- 数组前面那些其实已经越出可玩路径的球，仍然会参与“满链目标位置”的计算
- 结果就是剩余可见球会突然用 `close` 速度猛追一段
- 视觉上像是在补旧账，而不是延续当前滚动

现在的修正步骤是：

1. 先 `syncChainPositions()`，避免用旧的 `s` 做判断
2. 找到当前首颗可见球 `firstVisibleIndex`
3. 若删除区间覆盖它，说明这是 visible-head removal
4. 删除后顺手裁掉它前方那些已越界 leader balls
5. 用 `shiftChainBaseline()` / `absorbHeadRemovalIntoBaseline()` 把这部分距离吸收到 `chainHeadS`
6. 若删除前存在前链回拉，还要用 `alignVisibleHeadToAnchor()` 再校正一次 shared baseline
7. 若剩余整段还带着完全相同的 `close` offset，则再吸收到 baseline，避免最后一段假冲刺

核心思想不是“让球不动”，而是“把共有位移从 per-ball offset 转回 shared baseline”。

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

然后通过 `getSplitLocalOffset(index)` 对整段前链施加**均匀**的负向位移（刚性平移）：

- 所有前段球获得相同的 `-frontPull` 偏移
- 球间间距始终不变（保持 1px 重叠）
- 整段像刚体一样向接缝方向后退

参数调优使前段回拉速度与后段追赶速度一致（`RATIO=1.0`），视觉上前后双向对称合拢。

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

1. 取前链的统一回拉量（`-frontPull`）
2. 把它吸收到 `chainHeadS`
3. 前段球无残留差异（刚性平移下 residual = 0）；后段球获得等量正向 offset 补偿 baseline 偏移
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
2. 屏幕震动偏移（仅失败后短暂生效，`screenShake > 0` 时 `ctx.translate` 随机偏移）
3. 静态场景缓存（背景 + 轨道 + 终点，一次性预渲染到离屏 canvas，`drawImage` 直接贴）
4. 球链
5. 粒子层（消除碎片 + 胜利庆祝粒子）
6. 发射球
7. 瞄准辅助
8. 石蛙发射器（预缓存两层离屏 canvas + 实时画嘴中球和腹部球）
9. 顶部 HUD（面板底图预缓存，文字实时绘制）
10. 匹配反馈
11. 恢复震动偏移
12. 回合结束特效（胜利金色光晕 / 失败红色暗角）
13. 结束卡片

这个顺序保证：

- 轨道总是在球链下方
- HUD 总在场景最上层
- 结束卡片能盖住游戏画面

### 13.2 球体绘制

`drawBall()` 使用分层缓存策略：

- 基底层（body gradient）：预渲染到 `ballBaseCache[paletteIndex]` 离屏 canvas，运行时 `drawImage`
- 滚动腰带（rolling band）：必须实时绘制（依赖 rotation），但腰带边缘阴影预缓存到 `bandShadeCache`
- 叠加层（matte shade + worn bloom）：预渲染到共享 `ballOverCache`，运行时 `drawImage`

球的”滚动感”来自：

```text
rotation = s / radius
```

标准半径（`BALL_RADIUS = 14`）的球使用全缓存路径（0 gradient/球），非标准半径的预览球走 fallback 路径（3 gradient/球）。

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

1. 所有逻辑基于固定分辨率（430 × 932）
2. 手机端全屏：移除 PC 端的圆角手机容器，canvas 填满整个视口（`100vw × 100dvh`）
3. 所有按钮都在 canvas 内部统一坐标系中绘制和命中
4. 输入层统一用 pointer events
5. UI 点击命中优先于玩法输入

### 手机端全屏适配细节

**检测条件**：`(pointer: coarse) AND innerWidth < 700` 时进入移动全屏模式。

**缩放策略**：
- `scale = vw / GAME_WIDTH`（均匀缩放，填满宽度，无侧边空白，无变形）
- DPR 上限为 2（避免高 DPR 设备 canvas 过大）
- Canvas 物理尺寸 = `vw × dpr` × `vh × dpr`
- Canvas transform：`setTransform(scale×dpr, 0, 0, scale×dpr, 0, 0)`

**垂直溢出处理**：
- 当 `GAME_HEIGHT × scale > vh`（手机屏幕比 430:932 更矮），游戏底部会超出视口
- `cropBottom = (gameScreenH - vh) / scale`：在不做任何额外偏移时会被截掉的游戏坐标像素数
- HUD 始终固定在屏幕顶端（`cropTop = 0`）
- 底部"选关"按钮上移 `cropBottom + safeBottom/scale`，保持在可见区域内
- 裁剪来自游戏区域的上下余量（HUD 下的缓冲空间 + 底部按钮条），永不裁进 HUD 本身

**路径居中（playShift）**：
- 只靠"砍底"会让路径整体偏上，视觉上不居中。为此在 HUD 下方的可见游戏区内把路径的几何中心对齐到该区域的垂直中心
- 只处理**游戏区图层**（背景图、轨道、珠链、射手、粒子）：在渲染时整体 `ctx.translate(0, -playShift)`
- HUD / 结算卡片 / 关卡选择界面**不**跟随偏移，HUD 始终钉在屏幕顶端
- 计算方式（见 `resize()`）：
  - `pathMidY = (pathYBounds.minY + pathYBounds.maxY) / 2`（游戏坐标系，忽略 `x > GAME_WIDTH` 的入口曲线）
  - `hudHeight = HUD_HEIGHT + hudShift`
  - `visiblePlayH = vh / scale − hudHeight`
  - `desiredVisibleY = hudHeight + visiblePlayH / 2`（路径中心希望落在的屏幕逻辑 y）
  - 由 `pathMidY − playShift = desiredVisibleY` 解得 `playShift = pathMidY − desiredVisibleY`
  - 钳位：`playShift ∈ [0, cropBottom]`
    - 下限 0：绝不向下偏移（否则游戏区顶会被 HUD 盖住或露出黑边）
    - 上限 `cropBottom`：再多就会让底部按钮条重新探出视口底部，反而出现空白
- `playShift` 由 `resize()` 计算，并在 `createPath()` 末尾重新调用 `resize()`，保证换关时与新路径同步

**静态场景裁剪框（移动端放开底部）**：
- `createStaticSceneCache()` 在画授权背景图和轨道/终点时都用一个 clip 矩形，避免画到 HUD / 底部按钮条
- 原来 clip 底边是 `GAME_HEIGHT − BOTTOM_BUTTON_HEIGHT`，也就是始终为底部按钮条保留一条"不绘背景"的区域
- `playShift > 0` 时这条保留区会被上推进入视口，表现为一条突兀的 slab 灰色横带
- 解决办法：移动端（`mobileLayout.active`）下把 clip 底边放到 `GAME_HEIGHT`，让授权背景图和 procedural slab 一起铺到画布最下。素材本身不需要强制画到 932——画到哪儿结束，下面就自然过渡到 slab 渐变，不会再出现按钮条形状的硬边灰条
- 桌面端保持原样（底部按钮条仍然保留），不受影响

**坐标空间与指针映射**：
- `pointer` 存放**屏幕逻辑坐标**（未做 `playShift` 修正）：
  - `pointer.x = (clientX − rect.left) / scale`
  - `pointer.y = (clientY − rect.top) / scale`
- `shooter.y` 是**游戏逻辑坐标**（和路径、珠链同一空间，带 `playShift` 偏移）
- `updateAim()` 内部把两套空间对齐：`target.y = pointer.y + playShift`，再与 `shooter.y` 比较
- HUD 按钮矩形也在屏幕逻辑空间，和 `pointer` 直接比，不需要加 `playShift`
- `resetRound()` / `pointerleave` 里把指针重置到"射手右上方"时，要反向减去 `playShift` 才能落在屏幕逻辑空间

**刘海/灵动岛避让**：
- 安全区通过 CSS `env(safe-area-inset-*)` 和自定义属性 `--raw-sat/sab/sal/sar` 获取
- `hudShift = max(0, safeTop / scale - 14)`：将 HUD 交互元素（按钮、预览球）推到刘海下方
- HUD 面板背景保持 y=0，其颜色自然延伸到刘海后面
- 当 `hudShift > 0` 或 `playShift > 0` 时，整条 HUD 高度（`HUD_HEIGHT + hudShift`）填满 canopy 渐变（`#17383e → #10272d`），避免偏移后的游戏区从 HUD 面板透明区（x&lt;16 或 x&gt;248）漏出

**底部安全区**：
- 矮屏手机（`cropBottom > 0`）：游戏背景自然延伸到 home indicator 后面，不额外填充
- 高屏手机（`cropBottom = 0`）：底部间隙用 slab 渐变（`#5b646d → #3a4248`）填充

**横屏处理**：显示旋转提示遮罩，不提供横屏支持。

这套方案的优点是：

- 不需要写一套 DOM HUD 再做坐标同步
- 手机和桌面行为更一致
- 全屏沉浸体验，无 PC 端容器装饰
- 游戏画面无变形，通过裁剪余量 + 路径居中偏移适配不同屏幕比例

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

### 16.1 ~~单文件过大~~ ✅ 已解决

代码已拆分为 10 个 ES 模块：

- `config.js`：常量和颜色表
- `sfx.js`：音频合成
- `path.js`：路径采样、几何查询、多路径类型调度器
- `chain.js`：链条推进、插入、断链、并链
- `match.js`：action context、计分、连击、匹配检测
- `projectile.js`：弹射体飞行、碰撞、插入
- `render.js`：所有绘制函数和纹理生成（含关卡选择界面）
- `levels.js`：8 关卡配置数组（路径类型、球链数、颜色数、链速等）
- `save.js`：localStorage 持久化（关卡解锁进度、最高分）
- `main.js`：ZumaGame 编排器、输入、粒子、游戏循环、关卡管理

模块间通过 `game.*` 委托包装方法路由，无循环依赖。

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

模块化拆分已完成。后续维护建议：

1. 新功能按模块归属添加（如特殊球规则加到 `match.js`/`chain.js`，新渲染效果加到 `render.js`）
2. 跨模块调用统一走 `game.*` 委托包装，保持无循环依赖
3. 开发时需通过 HTTP 服务（`python3 -m http.server 8000`），不能直接打开 `file://`
4. 如果某个模块（如 `render.js` 的 1729 行）继续膨胀，可以进一步拆分为子模块

## 18. ~~建议的下一步重构切口~~ ✅ 已完成

模块化拆分已按以下顺序完成：

1. ✅ 路径与几何 → `path.js`（Phase 4 扩展为多路径调度器）
2. ✅ 计分与事件流 → `match.js`
3. ✅ 断链系统 → `chain.js`（Phase 4 读取关卡配置）
4. ✅ 弹射体 → `projectile.js`
5. ✅ 渲染 → `render.js`（Phase 4 新增关卡选择/全通界面）
6. ✅ 音频 → `sfx.js`
7. ✅ 常量 → `config.js`
8. ✅ 关卡配置 → `levels.js`（Phase 4 新增）
9. ✅ 存档持久化 → `save.js`（Phase 4 新增）

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

## 19. 2026-04-18 发射器与性能缓存更新

### 石蛙发射器

发射器已替换为经典 Zuma 风格的石蛙造型（玛雅/阿兹特克石雕）。

造型构成：
- 蹲踞蛙身（贝塞尔曲线轮廓 + 石质渐变 + 雕刻纹横带 + 青铜底座环 + 两侧前肢）
- 蛙头/嘴（上颚覆盖球上部制造"含住"效果，下颚在球后方）
- 石质隆起眼球（金色虹膜环 + 竖缝爬虫瞳孔）
- 腹部凹槽（下一球预览）

整只蛙随瞄准角度旋转，地面投影不旋转。蛙体预渲染到两层离屏 canvas（behind-ball / front-of-ball），运行时只实时绘制嘴中球和腹部球。

### 渲染缓存架构

为解决每帧约 190 个 gradient 创建 + 1848 次 lineTo 导致的严重卡顿，实施了全面的离屏 canvas 缓存策略：

| 缓存 | 内容 | 何时创建 |
|------|------|----------|
| `staticSceneCache` | 背景渐变 + 可选的关卡背景图片 + 终点（关卡配置了 `background` 时跳过程序化 `drawTrack`） | `createStaticSceneCache()` |
| `cachedTrackPath` (Path2D) | 轨道折线 (~616 点) | `createPath()` |
| `ballBaseCache[palette]` | 每种颜色的球体基底 gradient | `createBallRenderCache()` |
| `ballOverCache` | 共享的 matte shade + worn bloom 叠加 | `createBallRenderCache()` |
| `bandShadeCache` | 腰带边缘阴影 | `createBallRenderCache()` |
| `frogCacheBehind` | 蛙身 + 下颚 + 口腔 + 腹部凹槽 | `createFrogCache()` |
| `frogCacheFront` | 上颚 + 鼻孔 + 青铜描边 + 眼睛 | `createFrogCache()` |
| `hudPanelCache` | HUD 面板底图：石面板 + 石纹斑点 + 玛雅锯齿金边 + 太阳图标 + 子面板微纹理 | `drawOverlay()` 首次调用时 |

优化结果：gradient 创建从 ~190/帧 降到 ~8/帧，lineTo 从 1848/帧降到 0。`ctx.shadowBlur` 调用降到 0（Canvas 2D shadowBlur 触发 GPU 高斯模糊，开销极高；全部改为手工偏移渲染——先画深色偏移 +1px 文字，再画正色原位文字）。

补充约束：`fillRoundedRect()` 只用于“确实要填充”的场景；如果只是给 `clip()` 或 `stroke()` 提供圆角路径，必须使用 `traceRoundedRect()`。2026-04-19 的 HUD 回归问题就是因为 `hudPanelCache` 在裁剪前误调用了 `fillRoundedRect()`，把左侧标题石板先用默认黑色填了一层。

新增渲染代码时，应优先检查 gradient 或路径是否可以纳入上述缓存体系，避免回退到每帧重建。

## 20. 2026-04-18 Ball Material And Rolling Texture Update

This section supplements the earlier rendering notes with the current Phase 3 implementation.

### Current Ball Rendering Pipeline
The ball is now drawn using a cached-layer approach:
1. Cached stone-body base layer (`ballBaseCache[palette]`) — `drawImage`.
2. Live rolling equatorial symbol band (rotation-dependent, with cached band shading).
3. Cached overlay layer (`ballOverCache`) — matte re-shading + warm wear highlight.

The pipeline functions are:
- `createBallRenderCache()` — pre-renders base/overlay/band-shade canvases at startup
- `drawBall()` — runtime compositor using `drawImage` + live belt drawing
- `drawRollingBandTexture()` — belt tiles + cached shade overlay
- `createBallPatternCanvas()` — generates belt source texture per palette
- `drawTempleGlyph()` — draws per-palette glyph into belt
- `makeHorizontalTextureSeamless()` — blends belt edges for seamless tiling

### Why The Renderer No Longer Uses Pseudo Full-Sphere Projection
An earlier experiment tried to project a full texture map over the visible sphere. In practice it caused three recurring issues:
- the center symbol stretched unnaturally,
- the front-facing read looked like a sticker glued to the ball,
- the seam became easier to notice during rotation.

The current renderer deliberately models only a rolling equatorial belt. This is less physically correct, but visually more stable and more readable at the current mobile ball size.

### Current Texture Constraints
The belt source texture must satisfy all of the following:
- horizontal tiling without obvious left/right value shifts,
- a dominant front glyph that remains legible during rotation,
- lower-contrast ornament lines so the motif reads as carved stone instead of UI iconography,
- post-pass seam blending to damp residual edge mismatch.

### Current Known Tradeoff
The current belt approach is the preferred compromise for now:
- pros: cleaner rolling read, fewer uncanny distortions, easier mobile readability,
- cons: it is a visual simulation of wrapped stone ornament, not a true full-sphere texture projection.

Future material work should continue on top of this model unless a later rewrite introduces a genuinely better sphere-mapping solution.

## 21. 2026-04-19 Phase 4: Multi-Level System & Persistence

Phase 4 transforms the single-level prototype into a complete 8-level game with persistence. Two new modules were added (`levels.js`, `save.js`), and existing modules were extended.

### 21.1 Level Configuration (`levels.js`)

`levels.js` exports a `LEVELS` array of 8 level config objects. Each level specifies:

| 字段 | 含义 |
|------|------|
| `name` | 关卡显示名称 |
| `pathType` | 路径类型：`"spiral"` / `"serpentine"` / `"rectangular"` / `"zigzag"` / `"openArc"` / `"bezier"`(quadratic) / `"cubic"` |
| `pathParams` | 路径生成器的参数（圈数、振幅、段数等） |
| `chainCount` | 初始球链长度 |
| `colorCount` | 使用的颜色数（3–5，影响难度） |
| `chainSpeed` | 链条前进速度 |
| `shooterX` / `shooterY` | 发射器位置（不同路径需要不同中心点） |
| `background`（可选） | 关卡背景图配置：`{ src, x, y, scale }`。仅 `level-paths.json` 指定；缺失时走程序化渐变 + `drawTrack` 降级。`src` 相对 `public/` 根（如 `backgrounds/level-1.jpg`），`x/y/scale` 由路径编辑器的"保存为本关背景"按钮写入，对应运行时 `ctx.translate + ctx.scale + drawImage` 参数。|

难度曲线通过逐关增加 `colorCount`、`chainCount`、`chainSpeed` 实现。

### 21.2 Save/Load (`save.js`)

`save.js` 提供 localStorage 持久化：

- `loadProgress()` — 读取已解锁关卡索引和各关最高分
- `saveProgress(levelProgress)` — 写入进度
- `resetProgress()` — 清除存档

数据模型：

```js
levelProgress = {
  unlockedUpTo: <int>,     // 最高已解锁关卡索引
  scores: [<int>, ...]     // 每关最高分（未通关为 0）
}
```

通关一关自动解锁下一关。进度在每次 `onLevelWin()` 时保存。

### 21.3 Level Management in `main.js`

ZumaGame 新增的关卡管理字段和方法：

| 字段/方法 | 职责 |
|-----------|------|
| `currentLevel` | 当前关卡索引 (0-based) |
| `levelConfig` | 当前关卡的配置对象（从 LEVELS 数组取出） |
| `levelProgress` | 解锁进度与最高分 |
| `loadLevel(index)` | 加载指定关卡：设置 levelConfig → createPath → resetRound |
| `goToLevelSelect()` | 切换到 `levelSelect` 状态 |
| `onLevelWin()` | 通关处理：更新进度 → 保存 → 展示胜利界面 |
| `onLevelLose()` | 失败处理：展示重试/返回选项 |

### 21.4 Level Config Flow

关卡配置从定义到运行时的流动路径：

```
levels.js (LEVELS[])
  ↓
main.js loadLevel(index)
  ├→ game.levelConfig = LEVELS[index]
  ├→ path.js createPath(shooterX, shooterY, pathType, pathParams)
  ├→ chain.js updateChain() 读取 game.levelConfig.chainSpeed (fallback: CHAIN_SPEED)
  ├→ chain.js createInitialChain() 读取 game.levelConfig.chainCount, colorCount
  └→ render.js 显示关卡名称到 HUD
```

`chain.js` 中的动态参数读取：
- `chainCount`：初始生成球链时使用的球数
- `colorCount`：随机颜色范围（影响匹配概率，即难度核心）
- `chainSpeed`：`chainHeadS` 每帧推进量的基准速度

所有这些都通过 `game.levelConfig.*` 访问，并提供 fallback 到 `config.js` 中的全局常量，确保向后兼容。

### 21.5 Fade Transitions

关卡切换使用淡入淡出过渡：

- `fadeOverlay` 状态对象：`{ alpha, direction, callback }`
- `startFade(callback)` — 启动淡出 → 执行回调 → 淡入
- `updateFade(dt)` — 每帧更新 alpha，在 alpha=1 时执行回调（关卡加载/界面切换）

这避免了关卡切换时的突兀画面跳转。

### 21.6 Render Additions for Phase 4

`render.js` 新增的绘制函数：

| 函数 | 职责 |
|------|------|
| `drawLevelSelectScreen()` | 关卡选择主界面（标题 + 关卡按钮网格） |
| `drawLevelButton()` | 单个关卡按钮（序号、锁定状态、最高分） |
| `drawPathThumbnail()` | 关卡按钮内的微缩路径预览 |
| `drawAllClearScreen()` | 全部通关庆祝界面 |

HUD 也新增了：
- 左上角返回按钮（返回关卡选择）
- 动态关卡名称显示（替代固定标题）

### 21.7 Module Dependency Graph (Phase 4, 10 modules)

```
config.js   sfx.js   levels.js   save.js  (no deps)
   ↑
   ├── path.js
   ├── chain.js
   ├── match.js
   ├── projectile.js
   ├── render.js
   └── main.js ← imports from ALL modules (including levels.js, save.js)
```

`levels.js` 和 `save.js` 与其他模块无直接依赖，仅被 `main.js` 导入。`chain.js` 通过 `game.levelConfig` 间接读取关卡配置，不直接 import `levels.js`。
