# F1 Fantasy Local

中文 | [English](#english)

一个基于 FastF1 历史数据的本地 F1 Fantasy 模拟器。  
你可以选择真实赛季（JSON 导入）或内置演示赛季，进行完整的“选人-转会-结算-积分榜”循环。

---

## 中文

### 1. 项目特性

- 真实历史赛季支持：通过 FastF1 导出 2018-2025 赛季数据。
- 本地可运行：无后端服务，React + TypeScript + Vite。
- 完整玩法闭环：
  - Dashboard：车库阵容、周末战报、关键指标。
  - Transfer：双栏转会市场、预算进度、超额惩罚提示、芯片面板。
  - Standings：积分榜、名次涨跌箭头、累计走势曲线。
- 规则引擎内置：排位赛/冲刺赛/正赛积分、DRS、芯片、转会惩罚、动态身价。
- AI 经理对手：`fanatic` / `value` / `underdog` 三种风格。

### 2. 快速开始

#### 环境要求

- Node.js 20+
- npm 10+

#### 安装与运行

```bash
npm install
npm run dev
```

构建生产包：

```bash
npm run build
```

代码检查：

```bash
npm run lint
```

本地预览构建结果：

```bash
npm run preview
```

### 3. 导入真实赛季数据（可选）

如果只想快速体验，可直接使用内置 demo 赛季；  
如果要玩真实历史赛季，请先导出 JSON：

#### Python 依赖

- Python 3.10+
- `fastf1`
- `pandas`

安装依赖：

```bash
pip install fastf1 pandas
```

导出单赛季（示例 2024）：

```bash
python scripts/fetch_season_data.py --season 2024
```

导出全部赛季（2018-2025）：

```bash
python scripts/fetch_season_data.py --all
```

导出文件会写入：

- `src/data/seasons/{year}.json`

前端会自动扫描 `src/data/seasons/*.json` 并在赛季选择页展示。

### 4. 玩法概览

- 阵容：5 位车手 + 2 支车队。
- 预算：初始 `100M`。
- 每周常规加成：指定 1 位 DRS 车手（2x）。
- 芯片系统：`Extra DRS`、`Autopilot`、`No Negative`、`Limitless`、`Wildcard`、`Final Fix`。
- 转会规则：每轮有免费转会额度，超额会扣分（默认每次 `-10`）。
- 动态身价：按近期表现滚动调整，受上下限与单轮变动限制。

详细规则请查看：

- [f1_fantasy_rules.md](./f1_fantasy_rules.md)

### 5. 常见问题

- `npm run dev` 报 `spawn EPERM`：通常是受限环境/沙箱导致的进程创建限制，换到本机正常终端运行即可。
- 没有看到真实赛季：确认 `src/data/seasons/` 下已生成对应 JSON。
- 首轮转会处理与后续不同：这是有意设计，首轮用于开局建队，不按常规转会惩罚结算。

### 6. 目录说明

```text
src/
  components/        UI 组件
  context/           核心规则与状态管理（GameContext）
  data/              内置数据、赛季目录、JSON 加载
  views/             Dashboard / Transfer / Standings 页面
scripts/
  fetch_season_data.py   FastF1 赛季数据导出脚本
```

---

## English

### 1. What This Project Is

F1 Fantasy Local is an offline, browser-based fantasy simulator powered by historical FastF1 data.  
You can run full cycles of lineup building, transfers, weekend processing, and standings progression.

### 2. Key Features

- Real historical season support via FastF1 exports (2018-2025).
- Fully local app: React + TypeScript + Vite, no backend required.
- Full gameplay loop:
  - Dashboard: garage lineup, weekend report, key KPIs.
  - Transfer: split-view market, budget meter, penalties, chip panel.
  - Standings: ranking shifts, cumulative trend chart.
- Rules engine included:
  - qualifying/sprint/race scoring
  - DRS boost
  - chip logic
  - transfer penalties
  - dynamic pricing
- AI opponents with three styles: `fanatic`, `value`, `underdog`.

### 3. Quick Start

Requirements:

- Node.js 20+
- npm 10+

Install and run:

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

Preview production build:

```bash
npm run preview
```

### 4. Import Real Season Data (Optional)

The app ships with a built-in demo season so it runs out of the box.  
To use real historical seasons, export JSON first.

Python requirements:

- Python 3.10+
- `fastf1`
- `pandas`

Install:

```bash
pip install fastf1 pandas
```

Export one season (example: 2024):

```bash
python scripts/fetch_season_data.py --season 2024
```

Export all supported seasons:

```bash
python scripts/fetch_season_data.py --all
```

Output path:

- `src/data/seasons/{year}.json`

The frontend auto-discovers `src/data/seasons/*.json` in the season selector.
To add another season, rerun the script with `--season YEAR`; it will write a new JSON file into the same folder.

### 5. Gameplay Summary

- Lineup: 5 drivers + 2 constructors.
- Budget: `100M` at start.
- Weekly boost: one DRS driver (2x).
- Chips: `Extra DRS`, `Autopilot`, `No Negative`, `Limitless`, `Wildcard`, `Final Fix`.
- Transfers: free transfer allowance each round; extra transfers apply penalties (`-10` each by default).
- Dynamic pricing: rolling performance-based adjustments with floor/cap/change limits.

For full scoring and edge-case behavior, see:

- [f1_fantasy_rules.md](./f1_fantasy_rules.md)

### 6. Troubleshooting

- `spawn EPERM` during `npm run dev`: usually caused by restricted/sandboxed environments; run from a normal local terminal.
- Real seasons not showing up: verify JSON files exist under `src/data/seasons/`.
- Round 1 transfer behavior differs intentionally: opening round has special handling for initial squad setup.

### 7. Project Structure

```text
src/
  components/        UI components
  context/           core game rules and state management
  data/              fixture data, catalog loader, season JSON wiring
  views/             Dashboard / Transfer / Standings
scripts/
  fetch_season_data.py   FastF1 season exporter
```
