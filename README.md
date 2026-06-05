# F1 Fantasy Local

简体中文 | [English](#english)

🏎️ **专为 F1 粉丝与 Fantasy 玩家打造的本地模拟器**

你是否觉得官方的 F1 Fantasy 等待周期太长，每周只能操作一次？
你是否曾想过回溯经典的 F1 赛季，用当年的车手和赛车组建你的梦之队，测试你的策略？
**F1 Fantasy Local** 提供原汁原味的官方 F1 Fantasy 体验，加上全真数据的模拟结算，正是为了解决这些痛点而生。

---

### 1. 核心特色：原版 F1 Fantasy + 全真数据模拟

对于热爱的 F1 Fantasy 玩家来说，官方游戏存在游玩周期长、无法回溯和复盘等痛点。
本项目完全还原了**官方 F1 Fantasy 的核心玩法**，并基于 FastF1 提供的**真实历史比赛数据**进行全真模拟结算。

- **随时随地开局**：无需等待现实比赛，以你自己的节奏推进赛季，一小时打完一个赛季不是梦！
- **经典赛季回溯**：目前已内置 **2020-2025 赛季** 的全真比赛数据（后续将更新 2018-2019 两个赛季）。可以随时回到过去，组建你的无敌阵容。
- **与 AI 经理同台竞技**：内置三种不同风格的 AI 对手，让单机体验不再孤单：
  - 🤪 **狂热粉 (Fanatic)**：对某几位车手或车队极度偏爱，无论表现如何都会死忠持有，极具感性。
  - 📊 **性价比导向 (Value)**：典型的“理智型”玩家，只看重近期的数据得分与身价涨跌，频繁进行低买高卖的财务操作。
  - 🐎 **黑马挖掘机 (Underdog)**：喜欢在低价位捡漏，常常选出冷门组合以博取高额回报。

### 2. 核心玩法与详细规则

这里还原了极具深度且绝对真实的 F1 Fantasy 体验，比赛数据取材于 FastF1和Open F1：

#### 2.1 阵容与资金
- **初始阵容**：100M 初始预算，挑选 5 位车手 + 2 支车队。
- **动态身价**：根据车手/车队在过去三站的真实表现（3-GP Rolling Form），与他们的期望得分对比进行动态涨跌，单次涨跌幅在 ±$1.5M 之间。

#### 2.2 积分系统 (Scoring)
- **排位赛 (Qualifying)**：根据排位赛最终名次给分（1-10名依次递减）。如果未能做出有效成绩或被取消资格(DSQ)会扣分。车队还将获得旗下两位车手晋级 Q2/Q3 的额外加分。
- **冲刺赛 (Sprint)**：前 8 名获得积分。计算实际完赛位置与发车位的差值计算名次升降分，被超扣分，以及最快圈速加分。
- **正赛 (Race)**：前 10 名获得官方标准积分。计算实际完赛位置与发车位的差值（每提升一名+1分，下降一名-1分），正赛最快圈速 +10分，退赛/取消资格(DNF/DSQ) -20分。超车和最佳车手由于目前缺乏数据暂不支持。
- **进站换胎 (Pit Stops)**：提取当场比赛所有车队的进站通道耗时，最快进站车队 +15分，次快 +10分，第三快 +5分。由于数据原因，目前仅2024、2025赛季支持.

#### 2.3 卡牌系统与常规加成 (Chips & Boosts)
- **DRS 提升**：每周必须指定 1 位车手获得**双倍积分 (2x)**。
- **特权卡牌**（每个赛季每种仅可使用一次）：
  - **Extra DRS (3x)**：指定车手当站获得三倍积分。
  - **Autopilot**：当站结算后，自动将 2x 效果转移给队内得分最高的车手。
  - **No Negative**：如果当站任何成员积分为负数，则重置为 0 分。
  - **Limitless**：周末内取消 $100M 预算限制且无限次转会，赛后恢复。
  - **Wildcard**：周末内无限次免费转会（需在 $100M 预算内），且阵容修改是永久的。
  - 考虑到游戏机制，取消Final Fix卡牌

#### 2.4 转会规则
- **免费转会**：每轮拥有 2 次免费转会，可改变车手/车队选择；未使用的可结转至下轮（最多累计 3 次）。
- **超额扣分**：超出免费额度的每次转会，当周扣除 **-10分**。首轮建队阶段转会不限次数。

---

### 3. 技术细节与二次开发

本项目是一个纯本地运行的前端应用（React + TypeScript + Vite），不需要复杂的后端服务。

#### 安装与运行
- Node.js 20+ / npm 10+
```bash
npm install
npm run dev
```
打开浏览器访问本地地址即可游玩。

#### 赛季数据 (Season Data Structure)
为了方便其他开发者适配新赛季或构建自己的赛事数据，本项目的赛季数据均以 JSON 格式存储在 `src/data/seasons/` 目录下。单个赛季数据包含 `season` (年份) 和 `rounds` (分站列表)。
每个分站 (`RoundData`) 的结构大致如下：
- `round`: 分站序号。
- `raceName`, `country`, `date`: 基础赛事信息。
- `isSprint`: 是否包含冲刺赛周末。
- `qualifying`: 包含所有车手的排位赛名次、Q1/Q2/Q3 圈速及完赛状态。
- `sprint` (可选): 包含车手的起步与完赛名次、最快圈速及完赛状态。
- `race`: 包含车手的起步与完赛名次、正赛最快圈速、完赛状态，以及 `pitStops` (各车队的最快进站耗时排名)。
通过遵循此 JSON 数据结构，各位开发者可以轻松植入其他自定义赛季的数据。

---

## English

### 1. Core Features: Authentic F1 Fantasy + Realistic Simulation

For hardcore F1 Fantasy players, the official game suffers from long wait times and an inability to replay past events. This project solves that by providing the **original F1 Fantasy experience** powered by **real historical data** via FastF1.

- **Play at Your Own Pace**: No need to wait for real-life weekends. Breeze through an entire season in a day!
- **Relive Classic Seasons**: Currently features data from the **2020 to 2025 seasons** (2018-2019 will be added later). Go back in time and build your ultimate dream team.
- **Compete Against AI Managers**: Face off against three distinct styles of AI opponents:
  - 🤪 **Fanatic**: Blindly loyal to certain drivers or teams, holding onto them regardless of performance.
  - 📊 **Value**: A rational player focused strictly on recent stats and dynamic price changes, consistently buying low and selling high.
  - 🐎 **Underdog**: Loves finding cheap, unconventional picks hoping for massive returns.

### 2. Gameplay & Detailed Rules

This simulator recreates the authentic F1 Fantasy experience. All scoring is perfectly calculated using real FastF1 data:

#### 2.1 Garage & Budget
- **Lineup**: Start with a `$100M` budget to draft 5 drivers + 2 constructors.
- **Dynamic Pricing**: Asset prices adjust based on their real-world performance over the last 3 races (3-GP Rolling Form) compared to their expected points, shifting up to ±$1.5M per round.

#### 2.2 Scoring System
- **Qualifying**: Points are awarded based on final positions (1st to 10th). Penalty points for DNF/DSQ. Constructors get bonus points if their drivers advance to Q2/Q3.
- **Sprint Race**: Points for the top 8. Includes position gained/lost (overtakes) against grid position, and fastest lap bonuses.
- **Grand Prix Race**: Standard F1 points for the top 10. Position gained/lost bonuses (+1 pt for gaining, -1 pt for dropping), fastest lap (+10 pts), and DNF/DSQ penalties (-20 pts).
- **Pit Stops**: Constructors are ranked by their fastest pit stop durations in the race. 1st gets +15 pts, 2nd gets +10 pts, and 3rd gets +5 pts.

#### 2.3 Chips & Weekly Boost
- **DRS Boost**: One driver must be selected each race to score **2x points**.
- **Chips** (One use per season each):
  - **Extra DRS (3x)**: The selected driver scores 3x points.
  - **Autopilot**: Automatically transfers your 2x DRS boost to your highest-scoring driver after the race.
  - **No Negative**: Resets any negative-scoring driver/constructor to 0 points.
  - **Limitless**: Removes the $100M budget limit and allows unlimited transfers for one weekend.
  - **Wildcard**: Unlimited free transfers within the $100M budget. Roster changes are permanent.
  - **Final Fix**: Make exactly 1 transfer between qualifying and the race.

#### 2.4 Transfers
- **Free Transfers**: 2 free transfers per round. Can carry over to the next round (max accumulated: 3).
- **Penalties**: Any extra transfers beyond the free allowance cost **-10 points** each. Round 1 has unlimited transfers for setup.

---

### 3. Technical Details & Custom Seasons

This is an offline, browser-based app (React + TypeScript + Vite) with no backend required.

#### Quick Start
- Node.js 20+ / npm 10+
```bash
npm install
npm run dev
```
Open the provided local URL in your browser to play.

#### Season Data Structure
For developers looking to adapt or add new seasons, the data is stored in `src/data/seasons/` as JSON files. A season consists of `season` (year) and an array of `rounds`.
Each `RoundData` contains:
- `round`, `raceName`, `country`, `date`: Event metadata.
- `isSprint`: Boolean indicating if it's a Sprint weekend.
- `qualifying`: Array of driver results, Q1/Q2/Q3 lap times, and status.
- `sprint` (optional): Grid/Finish positions, fastest lap driver, and status.
- `race`: Grid/Finish positions, fastest lap driver, status, and `pitStops` (array of the fastest stop times per constructor).
By replicating this JSON format, you can integrate any custom racing data into the simulator.
