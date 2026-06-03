# F1 Fantasy UI Redesign Fix Plan

## Summary
这版计划按“问题 -> 修改位置 -> 具体改法 -> 验收点”来写，方便你后续逐项对接。整体原则是：小问题尽量精确到文件和行级结构，大问题精确到模块/函数，避免实现时再做二次判断。

## 1. 全局导航与启动页
**G1. 左侧导航语言不切换**
- 修改位置：[`src/components/Navigation.tsx`](D:/Tangerin/Personal/Code/F1 Fanatsy/src/components/Navigation.tsx:9)
- 现状原因：`NAV_ITEMS` 在模块顶层直接调用 `copyText`，只会在首屏加载时按当前语言生成一次，后续切换语言不会重新计算。
- 修改方式：
  - 把 `NAV_ITEMS` 从“已翻译文案数组”改成“纯数据数组”，只保存 `view` 和中英文原文。
  - 在 `Navigation` 组件 render 内部根据当前语言重新生成 `label` 和 `shortLabel`。
  - 保持移动端折叠显示逻辑不变，只改文案来源。
- 验收点：切换 EN / 中文 后，左侧“总览 / 转会 / 排行”即时切换。

**G2. 删除侧边栏里的 `FastF1 export`**
- 修改位置：[`src/App.tsx`](D:/Tangerin/Personal/Code/F1 Fanatsy/src/App.tsx:104)
- 修改方式：
  - 直接删除 `brand-block` 里的 `<small>` 文案，不做替换。
- 验收点：侧边栏不再出现 `FastF1 export` 字样。

**G3. 游戏开始界面文案重写**
- 修改位置：[`src/App.tsx`](D:/Tangerin/Personal/Code/F1 Fanatsy/src/App.tsx:20-50)
- 修改方式：
  - `F1 Fantasy 本地引擎` -> `F1 Fantasy 本地版`
  - hero 主标题替换成更面向 F1 粉丝的宣传语，去掉句末标点，建议方向是“像车队领队一样重跑完整赛季”“亲手调度阵容、预算与每一站比赛周”这一类表达。
  - hero 说明文案重写，避免提到 `FastF1`、`JSON`、`fixture`、`导出` 等技术词，改成面向玩家的体验描述。
  - 卡片入口里的 `真实导出` 改成 `真实赛季`。
- 验收点：启动页读起来像面向 F1 观众的游戏介绍，而不是技术说明。

**G4. 存档功能**
- 修改位置：
  - [`src/context/GameContext.tsx`](D:/Tangerin/Personal/Code/F1 Fanatsy/src/context/GameContext.tsx)
  - [`src/App.tsx`](D:/Tangerin/Personal/Code/F1 Fanatsy/src/App.tsx)
  - 可能还要加一个轻量存档 UI 入口，最好仍放在 App shell 的侧边栏或季节选择页
- 方案结构：
  - 保存内容：`version` + `savedAt` + 整个 `GameState`
  - 存储介质：`localStorage`
  - 恢复入口：季节选择页显示“继续游戏”
  - 退出/重开策略：保留现有“退出到赛季选择”，但不要自动清掉存档
- 需要处理的状态：
  - `selectedSeason`
  - `seasonData`
  - `currentRound`
  - `drivers`
  - `constructors`
  - `managers`
  - `currentView`
  - `isSeasonComplete`
  - `lastProcessedRound`
  - `roundResults`
- 额外建议：
  - 存档读写要做版本号校验，避免以后状态结构升级后无法恢复。
  - 保存前检查 `selectedSeason` 和 `seasonData` 是否存在。
- 验收点：能保存、刷新、继续，且恢复后功能状态一致。

## 2. Dashboard / 总览
**D1. 删除 hero 区多余说明**
- 修改位置：[`src/views/Dashboard.tsx`](D:/Tangerin/Personal/Code/F1 Fanatsy/src/views/Dashboard.tsx:73-92)
- 修改方式：
  - 删除第 74-77 行的“真实导出 / 开发样例”描述。
  - 删除第 87-92 行整段 hero description。
- 验收点：总览页顶部不再出现“ · 真实导出”和那段操作说明。

**D2. 当前阵容卡片填充车手/车队代表色**
- 修改位置：
  - [`src/views/Dashboard.tsx`](D:/Tangerin/Personal/Code/F1 Fanatsy/src/views/Dashboard.tsx:128-181)
  - [`src/lib/presentation.ts`](D:/Tangerin/Personal/Code/F1 Fanatsy/src/lib/presentation.ts:67-73)
- 修改方式：
  - 为 `DriverCard` 的车手/车队卡传入 `style={getTeamSurfaceStyle(..., season)}`。
  - `getTeamSurfaceStyle` 需要支持赛季参数，避免跨赛季车队名映射冲突。
  - 车手卡用所属车队色，车队卡直接用车队色。
- 验收点：当前阵容里的卡片底色和边缘色都明显带有车队代表色。

**D3. 第一场比赛结束前不显示折线图**
- 修改位置：[`src/components/DriverCard.tsx`](D:/Tangerin/Personal/Code/F1 Fanatsy/src/components/DriverCard.tsx:20-55)
- 修改方式：
  - 只有当 `recentScores.length >= 2` 时才渲染 `Sparkline`。
  - 首站前 `recentScores` 为空，首站后只有 1 个点，这两种情况都不显示折线图。
- 验收点：第一站处理完后，卡片里不会出现只有一个点的“假折线”。

**D4. `2X DRS` 标签位置与文案调整**
- 修改位置：
  - [`src/views/Dashboard.tsx`](D:/Tangerin/Personal/Code/F1 Fanatsy/src/views/Dashboard.tsx:158-170)
  - [`src/App.css`](D:/Tangerin/Personal/Code/F1 Fanatsy/src/App.css:557-575)
- 修改方式：
  - 标签文案从 `2X DRS` 改成 `2X`。
  - 标签移动到对应车手卡右上角。
  - 标签面积缩小一点，但保持可读性。
  - 同时把标题右侧留白减小，避免标签压住标题。
- 验收点：`2X` 像角标一样挂在车手卡右上角，而不是浮在卡片中间。

**D5. “上一站得分拆解”增加阶段细则**
- 修改位置：
  - [`src/types.ts`](D:/Tangerin/Personal/Code/F1 Fanatsy/src/types.ts)
  - [`src/context/GameContext.tsx`](D:/Tangerin/Personal/Code/F1 Fanatsy/src/context/GameContext.tsx:324-430, 849-942)
  - [`src/views/Dashboard.tsx`](D:/Tangerin/Personal/Code/F1 Fanatsy/src/views/Dashboard.tsx:360-430)
- 修改方式：
  - 在 `DriverRoundScore` / `ConstructorRoundScore` 上增加“分项明细”结构，至少能表示排位、冲刺、正赛、进站等来源。
  - 在 `buildDriverScoreMap` 和 `buildConstructorScoreMap` 中保留每个阶段的原始分数来源，而不只输出汇总数字。
  - 在弹窗里把“排位赛 / 冲刺赛 / 正赛 / 进站”等块改成可点击或可展开项，点击后显示该阶段具体分数来源与细则，具体规则参考`D:\Tangerin\Personal\Code\F1 Fantasy\f1_fantasy_rules.md`
  - 没有冲刺赛的周末不显示“冲刺赛”框。
- 验收点：点“排位赛”“正赛”能看到具体怎么拿分，没冲刺的周末不会硬塞一个空框。

**D6. Weekend summary 深度信息重排**
- 修改位置：
  - [`src/views/Dashboard.tsx`](D:/Tangerin/Personal/Code/F1 Fanatsy/src/views/Dashboard.tsx:271-357)
  - [`src/App.css`](D:/Tangerin/Personal/Code/F1 Fanatsy/src/App.css:196, 690-740)
- 修改方式：
  - 按钮文案改成 `查看完整周末详情`。
  - 深度信息面板里，保留现有结构风格，但重排内容顺序为：
    - 上方：排位赛结果 + 正赛结果
    - 下方：进站时间榜 + 超车榜
    - 有冲刺赛的周末：最下方再加冲刺赛结果
  - 把现在被隐藏的排位赛卡恢复显示。
- 验收点：打开后先看到排位和正赛，再看到进站与超车，冲刺周末会多出一块冲刺赛结果。

**D7. Weekend summary 右上角去掉国家名**
- 修改位置：[`src/views/Dashboard.tsx`](D:/Tangerin/Personal/Code/F1 Fanatsy/src/views/Dashboard.tsx:203-209)
- 修改方式：
  - 删除 `lastRoundData.country` 的显示，只保留 `raceName`。
- 验收点：右上角只剩 `XX Grand Prix`，不再有国家名前缀。

## 3. Transfer Center / 转会
**T1. 车队代表色修正**
- 修改位置：
  - [`src/lib/presentation.ts`](D:/Tangerin/Personal/Code/F1 Fanatsy/src/lib/presentation.ts:25-73)
  - [`src/views/Transfer.tsx`](D:/Tangerin/Personal/Code/F1 Fanatsy/src/views/Transfer.tsx:192-366)
  - 如果 Dashboard 也要上色，再一起接入同一套函数
- 先说明根因：
  - 当前问题不是单纯“颜色值写错”，而是“同一车队在不同年份的 JSON 里叫法不统一”，例如 `Red Bull` / `Red Bull Racing` / `Alpine F1 Team` / `Kick Sauber` / `Alfa Romeo` / `Sauber`。
  - 现有 `TEAM_COLORS` 只按字符串精确匹配，没有按赛季归一化，所以会在部分赛季失配。
- 修改方式：
  - `getTeamColors(team, season)` 增加赛季参数。
  - 新增车队名归一化函数，把不同赛季的同车队名称统一到一个逻辑 key。
  - 配色规则采用“赛季版配置 + 统一回退”：
    - 2022、2023、2024、2025 各用指定渐变
    - 没有额外说明的更早赛季，一律沿用 2022 版配色
  - 需要保证 2022 前的所有赛季都走 2022 配色，不再另分支。
- 验收点：你列出的红牛、Alpine、RB、Sauber / Alfa Romeo / Kick Sauber 在指定赛季里颜色一致且正确，2022 以前统一使用 2022 配色。

**T2. Chips 面板视觉增强**
- 修改位置：[`src/App.css`](D:/Tangerin/Personal/Code/F1 Fanatsy/src/App.css:812-860)
- 修改方式：
  - 扩大 `chip-badge` 的高度和内部间距。
  - 放大 Chip 名称字号，并加粗。
  - 字体风格跟上面的车手选择字体统一，减少“功能区”和“阵容区”视觉割裂。
- 验收点：每个 Chip 卡更像一个完整按钮，而不是紧凑标签。

**T3. 转会市场右侧区域没有撑满矩形高度**
- 修改位置：
  - [`src/views/Transfer.tsx`](D:/Tangerin/Personal/Code/F1 Fanatsy/src/views/Transfer.tsx:300-386)
  - [`src/App.css`](D:/Tangerin/Personal/Code/F1 Fanatsy/src/App.css:768-780, 780-865)
- 这里我按你的澄清重新理解：
  - 问题不是“列表条目太少”本身，而是右边“全部车手”这块市场面板没有把它所在的矩形区域用满，高度看起来比左边待替换槽位那一栏更空，导致左右不对称。
- 修改方式：
  - 让右侧市场面板本身成为纵向 flex 容器。
  - 让标题区固定高度，列表区吃掉剩余空间。
  - `market-list--scroll` 改成真正的“弹性滚动区”，高度跟随面板拉伸，而不是只靠 `max-height` 固定一截。
  - 不增加卡片区域外层尺寸，而是让现有矩形内部布局更充分。
- 验收点：右侧“全部车手 / 全部车队”区域能像左边待替换槽位一样把矩形空间用满，看起来对称。

**T4. 车号缺失问题先说明原因**
- 修改位置：[`src/lib/presentation.ts`](D:/Tangerin/Personal/Code/F1 Fanatsy/src/lib/presentation.ts:38-62)
- 结论：
  - 这是代码问题，不是数据问题。
  - 数据里这些车手缩写是存在的，缺失来自 `DRIVER_NUMBERS` 映射不完整。
- 修改方式：
  - 补齐以下映射：
    - `BEA: 87`
    - `LAW: 30`
    - `BOR: 5`
    - `DOO: 7`
    - `HAD: 6`
    - `DEV: 21`
    - `MSC: 47`
    - `LAT: 6`
  - `SAR` 已经存在，不需要补。
- 验收点：这些车手在市场、阵容、详情页里都能正确显示车号。

**T5. 转会市场显示上一场后的价格变化**
- 修改位置：
  - [`src/types.ts`](D:/Tangerin/Personal/Code/F1 Fanatsy/src/types.ts)
  - [`src/context/GameContext.tsx`](D:/Tangerin/Personal/Code/F1 Fanatsy/src/context/GameContext.tsx:829-847, 1310-1332)
  - [`src/views/Transfer.tsx`](D:/Tangerin/Personal/Code/F1 Fanatsy/src/views/Transfer.tsx:328-386)
- 先按你的补充明确范围：
  - 第一场比赛前不显示价格变化。
- 修改方式：
  - 在资产类型里增加 `lastPriceChange`。
  - 初始化时设为 `0`。
  - 每轮价格更新时，把“新价格 - 旧价格”记录下来。
  - 首场赛前或首轮未处理时，不渲染变化值。
  - 字体和右侧积分显示统一
  - 市场列表中展示格式建议为：
    - 上涨：`+0.3M`
    - 下跌：`-0.5M`
    - 首场前：不显示或显示空占位
- 验收点：第二场开始后，每个车手条目都能看到相对上一场的价格变动。

## 4. Standing / 排名
**S1. 赛季积分榜显示更醒目的分数和排名变化**
- 修改位置：
  - [`src/views/Standings.tsx`](D:/Tangerin/Personal/Code/F1 Fanatsy/src/views/Standings.tsx:120-137)
  - [`src/App.css`](D:/Tangerin/Personal/Code/F1 Fanatsy/src/App.css:639-660)
- 修改方式：
  - 给右侧分数加单独 class，放大字号。
  - 排名变化箭头字号也要提升，确保变化幅度能一眼看见。
  - 保持行高和对齐方式不乱。
- 验收点：积分数字更突出，升降名次更容易扫读。

**S2. AI manager 策略优化，采用保守增强**
- 修改位置：
  - [`src/context/GameContext.tsx`](D:/Tangerin/Personal/Code/F1 Fanatsy/src/context/GameContext.tsx:630-827)
  - 重点是 `getPerformanceSnapshot`、`buildOpeningRoster`、`applyAiStrategy`
- 你已经指定“保守增强”，所以方案不做结构性重写，只在现有框架上加权。
- 修改方式：
  - 保留当前三类 AI 风格：`fanatic / value / underdog`
  - 调整选人逻辑时引入更保守的加权项：
    - 最近 3 站的稳定性权重
    - 赛季平均分权重
    - 价格效率权重
    - 转会罚分规避权重
    - DRS 目标选择不要过度追高，防止极端波动
  - `buildOpeningRoster` 继续作为主要入口，只改评分公式，不改整体搜索方式。
  - `applyAiStrategy` 仍然保留“按赛季进程重新评估阵容”的方式，但避免过于激进地频繁换人。
- 结果目标：
  - 让 AI 得分更稳，整体分数明显高于当前版本，但不追求“完美自动优化”。
- 验收点：AI 不再因为过于简单的策略频繁吃亏，得分更接近合理强度，同时保留不同风格差异。

**S3. 累计积分曲线支持负分**
- 修改位置：
  - [`src/views/Standings.tsx`](D:/Tangerin/Personal/Code/F1 Fanatsy/src/views/Standings.tsx:63-96)
  - 必要时补一点 [`src/App.css`](D:/Tangerin/Personal/Code/F1 Fanatsy/src/App.css:900+)
- 修改方式：
  - 不再只以 `maxValue` 计算 Y 轴。
  - 增加 `minValue`，让图表按 `[minValue, maxValue]` 的完整范围缩放。
  - 将 0 分基线固定为可见参考线。
- 验收点：累计曲线即使出现负分 manager，也能完整显示，不会“掉出画布”。



## Test Plan
- 语言切换后，检查左侧导航、按钮文案、启动页文案是否全部跟随切换。
- 选择真实赛季后，验证侧边栏不再显示 `FastF1 export`，启动页文案已改写。
- 处理首站前后，验证：
  - 总览卡片不显示折线图
  - 市场价格变化首轮前不显示、第二轮起显示
  - `2X` 标签位置正确
- 打开周末详情，验证四块顺序、冲刺赛条件显示、排位赛可见。
- 切换到不同赛季，验证车队颜色和车号映射正确，尤其是 2022-2025 的边界赛季。
- 保存/恢复存档，验证刷新后能继续，且状态不丢失。
- 在积分榜里验证负分曲线可见，排名变化与分数字号更清晰。
