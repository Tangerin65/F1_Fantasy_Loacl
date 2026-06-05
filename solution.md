# Bugs 修复计划
## Summary
这 17 条里，核心改动集中在 `src/lib/presentation.ts`、`src/App.tsx`、`src/views/Dashboard.tsx`、`src/views/Transfer.tsx`、`src/views/Standings.tsx`、`src/context/GameContext.tsx` 和 `src/App.css`。我会尽量保持内部数据 key 不动，只在展示层、样式层和少量交互层做归一化，这样风险最小，回归也最好控。

## 1. 2025 赛季车队名称统一显示
在 [`src/lib/presentation.ts`](D:/Tangerin/Personal/Code/F1%20Fantasy/src/lib/presentation.ts:29) 继续保留颜色归一化，但再补一个“展示名”归一化函数，按赛季把 `Red Bull` / `Red Bull Racing`、`RB F1 Team` / `Racing Bulls`、`Alpine F1 Team`、`Sauber` 这类别名收敛成同一个当季官方名。然后把 `Transfer.tsx`、`Dashboard.tsx`、`RaceControl.tsx` 里所有 `driver.team` / `constructor.name` 的可见文本改成走这个展示名 helper，内部 scoring key 不动。验收标准：2025 页面里不会再同时看到同一支车队的两个名字。

## 2. Antonelli 的 12 号车号补齐
直接改 [`src/lib/presentation.ts`](D:/Tangerin/Personal/Code%20F1%20Fantasy/src/lib/presentation.ts:136) 的 `DRIVER_NUMBERS`，补上 `ANT: '12'`。这个 helper 是全局共享的，所以补一次就会同时修好转会页、阵容页和积分榜里所有 Antonelli 的车号展示。

## 3. 2023 Alfa Romeo 颜色修正
在 [`src/lib/presentation.ts`](D:/Tangerin/Personal/Code%20F1%20Fantasy/src/lib/presentation.ts:78) 把 Sauber / Alfa Romeo 的 palette 从现在的双端渐变扩成多 stop 渐变，2023 这一档严格改成 `#050505 → #1A1A1A → #9E0B16 → #E10600`。同时保留“2022 以前默认走 2022 版配色”的回退规则，不新增别的年份分支。

## 4. 总览里的“最终得分”弹窗居中与自适应宽度
在 [`src/views/Dashboard.tsx`](D:/Tangerin/Personal/Code/F1%20Fantasy/src/views/Dashboard.tsx:406) 的 driver-detail 弹窗里，给 `Final` 那张卡单独加一个居中样式；弹窗宽度不要再固定成一档，而是根据是否有 sprint tile 走两档或三档宽度。建议做法是：3 张卡时用 compact，4 张卡时用 wide，必要时再给 constructor 细节分支一个更宽档。样式放到 [`src/App.css`](D:/Tangerin/Personal/Code%20F1%20Fantasy/src/App.css:1011) 这边，避免影响别的 summary grid。验收：没有 sprint 的时候弹窗收窄，有 sprint 的时候横向展开，Final 卡标题和数值都居中。

## 5. 当前阵容里底部说明文字更清楚
[`src/components/DriverCard.tsx`](D:/Tangerin/Personal/Code%20F1%20Fantasy/src/components/DriverCard.tsx:1) 组件结构不用动，重点改 [`src/App.css`](D:/Tangerin/Personal/Code%20F1%20Fantasy/src/App.css:690) 里的 `.asset-card__highlight`。把“点击查看上一站得分细则”和“近三站”这两行的颜色提亮，并加轻量描边或 text-shadow，保持字号不变。验收：在彩色矩形底上仍然一眼能看清这两行字。

## 6. 排位赛细则 / 正赛细则补中文
在 [`src/types.ts`](D:/Tangerin/Personal/Code%20F1%20Fantasy/src/types.ts:142) 把 `ScoreBreakdownItem` 改成能承载双语文本的结构，随后在 [`src/context/GameContext.tsx`](D:/Tangerin/Personal/Code%20F1%20Fantasy/src/context/GameContext.tsx:381) 的 `getQualifyingBreakdown` / `getSprintBreakdown` / `getRaceBreakdown`，以及 `buildConstructorScoreMap` 里把每一条明细都写成中英双版本。最后在 [`src/views/Dashboard.tsx`](D:/Tangerin/Personal/Code%20F1%20Fantasy/src/views/Dashboard.tsx:18) 的 `renderBreakdownList` 用 `copyText(...)` 渲染当前语言。注意：车手名、车队名、缩写都保留原样，不做翻译。

## 7. 删除右上方常驻横栏里的 Real Export
直接改 [`src/App.tsx`](D:/Tangerin/Personal/Code%20F1%20Fantasy/src/App.tsx:171)，把 HUD 中间那行 `Real Export / Dev Fixture` 的 `<small>` 整段删掉，不要换成别的技术标签。这样右上栏只保留赛季和状态信息。

## 8. 去掉所有车队代表色矩形的边框色差
在 [`src/lib/presentation.ts`](D:/Tangerin/Personal/Code%20F1%20Fantasy/src/lib/presentation.ts:121) 的 `getTeamSurfaceStyle` 里不再返回 `borderColor`，只保留背景渐变和文字颜色。这样 `asset-card`、`roster-row`、`market-row` 的外框会回到统一的中性边框，选中态仍然保留自己原本的强调边框和阴影，不会被误删。

## 9. 转会市场里的价格变化更醒目
在 [`src/views/Transfer.tsx`](D:/Tangerin/Personal/Code%20F1%20Fantasy/src/views/Transfer.tsx:336) 的价格区块里，给 `lastPriceChange` 这行加一个独立的高对比样式，不再只是裸露的小灰字。样式建议放在 [`src/App.css`](D:/Tangerin/Personal/Code%20F1%20Fantasy/src/App.css:1142) 的 `.price-change`，用深色底、细边框、轻描边或阴影来保证它在红/绿车队底色上依然能读。验收：涨跌值在任何队色上都看得清。

## 10. 转会市场高度和当前阵容对齐
在 [`src/views/Transfer.tsx`](D:/Tangerin/Personal/Code%20F1%20Fantasy/src/views/Transfer.tsx:303) 和 [`src/App.css`](D:/Tangerin/Personal/Code%20F1%20Fantasy/src/App.css:768) 把右侧“Transfer market”做成真正的 flex 列容器，`market-list--fill` 才是唯一的滚动区，外层矩形高度跟左边“Current roster”保持一致。重点是加上 `min-height: 0`，不要再靠 `max-height: 560px` 那套旧逻辑。验收：左右两栏的外框等高，车手列表超出时只在列表内部滚动。

## 11. 所有车手车号去掉 `#`
全局只改展示字符串，不动 `getDriverNumber` 本身。在 [`src/views/Transfer.tsx`](D:/Tangerin/Personal/Code%20F1%20Fantasy/src/views/Transfer.tsx:197) 的车手槽位、市场列表、2X/3X DRS 选择按钮，以及 [`src/views/Standings.tsx`](D:/Tangerin/Personal/Code%20F1%20Fantasy/src/views/Standings.tsx:340) 的积分榜详细阵容里，把 `#${getDriverNumber(...)}` 全部改成纯数字。验收：页面里不再出现车号前缀 `#`。

## 12. 游戏开始界面标题与文案
在 [`src/App.tsx`](D:/Tangerin/Personal/Code%20F1%20Fantasy/src/App.tsx:20) 的 `SeasonSelect` 里，把大标题改成完全相同的 `F1 Fantasy Loacl Edition`，中英文都用这一句，不翻译，按用户原文保留 `Loacl` 拼写。英文介绍要明显缩短，中文可以保留原意但也要收紧；如果还是挤，就删掉一部分 meta / supporting copy。配套地，把 [`src/App.css`](D:/Tangerin/Personal/Code%20F1%20Fantasy/src/App.css:1) 里季节选择页的正文尺寸和行宽调小一点，保证标题成为第一视觉焦点。验收：首屏更像游戏封面，不像技术说明页。

## 13. 选完车手后只跳到下一个车手槽，不跳到车队
在 [`src/views/Transfer.tsx`](D:/Tangerin/Personal/Code%20F1%20Fantasy/src/views/Transfer.tsx:190) 的车手换入流程里，替换成功后只推进 `activeDriverSlot` 到下一个 driver slot；如果已经是最后一个就保持原位。不要在这个路径里切到 constructor market，也不要碰 `activeConstructorSlot`。验收：用户填完一位车手后，焦点自然落到下一个车手槽位，车队部分仍需手动切换。

## 14. 赛季积分榜的排名变化箭头对齐
在 [`src/components/TrendArrow.tsx`](D:/Tangerin/Personal/Code%20F1%20Fantasy/src/components/TrendArrow.tsx:1) 和 [`src/App.css`](D:/Tangerin/Personal/Code%20F1%20Fantasy/src/App.css:639) 里，把趋势变化做成固定宽度、居中的 badge，右侧分数用 tabular numerals，避免位数变化把旁边的箭头视觉带歪。[`src/views/Standings.tsx`](D:/Tangerin/Personal/Code%20F1%20Fantasy/src/views/Standings.tsx:125) 只保留现有数据流，不改排序逻辑。验收：排名变化箭头和数字看起来稳定，不会随着右边积分长度晃动。

## 15. 展开 manager 详情里的 2X DRS 和分项对齐
在 [`src/views/Standings.tsx`](D:/Tangerin/Personal/Code%20F1%20Fantasy/src/views/Standings.tsx:325) 的 manager 详情弹窗里，把 `(${score.drsMultiplier}X DRS)` 改成 `(${score.drsMultiplier}X)`，去掉 `DRS` 后缀。然后把 driver / constructor 的 `Q / S / R / P` 那条摘要拆成固定宽度的结构化小块，而不是单纯一串文本，这样两类行能按同一列宽对齐。对应样式放在 [`src/App.css`](D:/Tangerin/Personal/Code%20F1%20Fantasy/src/App.css:976) 附近。验收：`Q -5 · S 0 · R 25` 这类行不会再东一块西一块。

## 16. 左侧语言切换改成设置菜单
在 [`src/App.tsx`](D:/Tangerin/Personal/Code%20F1%20Fantasy/src/App.tsx:74) 把当前 sidebar 的语言按钮区换成一个“设置”按钮，点开一个二级菜单。菜单里放两块东西：语言切换，以及“加载并结算周末后自动跳回总览 / 保持当前页面”的开关。语言状态继续用 `setUiLanguage` + 根组件 state 触发重渲染，但这个 UI preference 要单独持久化，别混进比赛存档；而自动跳转的决定要在 `GameContext` 的 `processCurrentRound` 路径里统一生效，这样顶栏按钮和 `RaceControl` 都会一致。验收：设置可以随时开关，语言和自动跳转行为在刷新后仍然保留。

## 17. 2X DRS 车手选择按钮排成一行
在 [`src/views/Transfer.tsx`](D:/Tangerin/Personal/Code%20F1%20Fantasy/src/views/Transfer.tsx:443) 的 Extra DRS 弹窗里，给 2X 区域单独做一个 one-row 版本的 selector 容器，让 5 位车手按钮在桌面端压成一行，必要时再微调 padding / font-size。3X 区域保留原来的布局即可，移动端可以沿用现有断点折叠。对应样式放在 [`src/App.css`](D:/Tangerin/Personal/Code%20F1%20Fantasy/src/App.css:1108) 附近。验收：5 个 2X 目标按钮不会再换行成两排。

## Test Plan
- 2025 赛季下检查所有车队名：同一支车队不会再以不同别名并列出现，Antonelli 显示 `12`。
- 切到 2023，确认 Alfa Romeo 的渐变准确；所有队色矩形没有混色边框，但选中态仍然明显。
- 打开总览里的上一站得分拆解，确认 Final 卡居中、弹窗宽度会随 sprint 有无变化；切换语言后，细则条目会即时变成中文。
- 进转会中心，确认价格变化文字可读、左右两栏等高、车号都没有 `#`，以及 2X DRS 的 5 个按钮能在一行显示。
- 在积分榜打开 manager 详情，确认 `2X` 显示正确、趋势箭头稳定、Q/S/R/P 的数据行对齐。
- 打开设置菜单，切换语言并切换“结算后自动回到总览”开关，再用顶栏和 RaceControl 各结算一次周末，确认两个入口行为一致。

## Assumptions
- 车队名统一只做展示层归一化，内部 scoring / save / 资产 key 继续沿用当前 raw 名称，避免破坏现有数据结构。
- `F1 Fantasy Loacl Edition` 按用户原文保留拼写，不会自动纠正成 `Local`。
- “结算后自动回到总览” 只控制处理中间轮次的导航；赛季结束时是否进入 season summary 继续沿用现有流程，除非后续你希望一起改。
- 2022 以前的 Sauber / Alfa Romeo 配色默认回退到 2022 版，除非后面再补更细的历史规则。
