# F1 Fantasy Local — 项目架构文档

> 本文档详细描述 F1 Fantasy Local 项目的完整架构，细化到每个文件夹和每个主要文件。

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术栈](#2-技术栈)
3. [目录树全览](#3-目录树全览)
4. [核心架构图](#4-核心架构图)
5. [根目录文件详解](#5-根目录文件详解)
6. [src/ 源代码详解](#6-src-源代码详解)
    - [入口层](#61-入口层)
    - [状态管理层](#62-状态管理层)
    - [类型定义层](#63-类型定义层)
    - [视图层](#64-视图层)
    - [组件层](#65-组件层)
    - [数据层](#66-数据层)
    - [工具库层](#67-工具库层)
    - [样式层](#68-样式层)
    - [静态资源层](#69-静态资源层)
7. [scripts/ 数据脚本详解](#7-scripts-数据脚本详解)
8. [public/ 公共资源](#8-public-公共资源)
9. [配置文件详解](#9-配置文件详解)
10. [CI/CD 与部署](#10-cicd-与部署)
11. [数据流全景](#11-数据流全景)
12. [核心算法](#12-核心算法)
13. [外部依赖](#13-外部依赖)

---

## 1. 项目概述

**F1 Fantasy Local** 是一个完全离线、基于浏览器的 F1 Fantasy 模拟器。玩家可以选择历史赛季（2018-2025），在 \$100M 预算内组建 5 名车手 + 2 支车队的阵容，与三名 AI 经理竞争，激活技能芯片，并按照自己的节奏处理整个赛季。

### 核心特性

- **完全离线**：无需后端服务器，所有数据本地存储
- **真实历史数据**：使用 FastF1 Python 库（OpenF1 API 降级）提取的真实比赛数据
- **AI 对手**：三名不同策略风格的 AI 经理（狂热粉丝、价值交易者、冷门猎手）
- **技能芯片系统**：DRS Boost、Extra DRS、Autopilot、No Negative、Limitless、Wildcard
- **动态定价**：基于 3 场滚动平均表现调整资产价格
- **双语界面**：中文 / English 切换
- **本地保存**：localStorage 持久化游戏进度

---

## 2. 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端框架 | React | 19.2.6 |
| 类型系统 | TypeScript | 6.0.2 |
| 构建工具 | Vite | 8.0.12 |
| 代码检查 | ESLint | 10.3 |
| 数据提取 | FastF1 (Python) | — |
| 容器化 | Docker (Node 20 + nginx) | — |
| CI/CD | GitHub Actions | — |

---

## 3. 目录树全览

```
F1 Fantasy/
│
├── .claude/                          # Claude Code 配置
│   └── settings.local.json           # 本地权限设置
│
├── .github/                          # GitHub 配置
│   └── workflows/
│       └── release.yml               # CI 发布流水线
│
├── f1_cache/                         # FastF1 HTTP 缓存
│   └── fastf1_http_cache.sqlite      # SQLite 缓存数据库
│
├── output/                           # 输出目录（空）
│
├── public/                           # 静态公共资源
│   ├── favicon.svg                   # 网站图标
│   └── icons.svg                     # SVG 图标精灵（社交图标）
│
├── scripts/                          # 数据提取脚本
│   ├── f1_cache/                     # FastF1 pickle 缓存目录
│   │   └── fastf1_http_cache.sqlite
│   ├── fetch_season_data.py          # 当前在用数据提取脚本
│   └── fetch_season_data_old.py      # 旧版数据提取脚本
│
├── src/                              # 应用源代码
│   ├── assets/                       # 静态资源
│   │   ├── hero.png                  # 赛季选择页英雄图
│   │   ├── react.svg                 # React 图标
│   │   └── vite.svg                  # Vite 图标
│   │
│   ├── components/                   # 可复用 UI 组件
│   │   ├── ChipBadge.tsx             # 芯片激活状态徽章
│   │   ├── DriverCard.tsx            # 车手/车队卡片（含火花线图）
│   │   ├── Navigation.tsx            # 侧边栏导航
│   │   ├── Sparkline.tsx             # SVG 火花线图
│   │   ├── TrendArrow.tsx            # 排名趋势箭头
│   │   └── ValueChip.tsx             # 侧边栏数值显示芯片
│   │
│   ├── context/                      # React 状态管理
│   │   ├── GameContext.tsx           # 核心游戏状态 + 全部游戏逻辑（~1936 行）
│   │   └── useGame.ts               # Context 消费者 Hook
│   │
│   ├── data/                         # 数据层
│   │   ├── demoSeason2024.ts         # 合成演示赛季（4 轮）
│   │   ├── initial_assets.ts         # 车手/车队种子数据 + 初始化器
│   │   ├── seasonCatalog.ts          # 赛季 JSON 加载器 + 目录构建器
│   │   └── seasons/                  # 真实赛季数据 (JSON)
│   │       ├── 2020.json             # 2020 赛季（6,393 行）
│   │       ├── 2021.json             # 2021 赛季
│   │       ├── 2022.json             # 2022 赛季
│   │       ├── 2023.json             # 2023 赛季
│   │       ├── 2024.json             # 2024 赛季
│   │       └── 2025.json             # 2025 赛季（11,635 行）
│   │
│   ├── lib/                          # 工具库
│   │   └── presentation.ts          # i18n、车队颜色、车手编号、名称格式化
│   │
│   ├── views/                        # 页面视图
│   │   ├── Dashboard.tsx             # 主面板（车库、周末报告、分数分解弹窗）
│   │   ├── RaceControl.tsx           # 比赛控制面板（未路由）
│   │   ├── SeasonSummary.tsx         # 赛季结束总结页
│   │   ├── Standings.tsx             # 积分榜 + SVG 累计分数图
│   │   └── Transfer.tsx              # 转会市场（阵容管理、DRS 分配、芯片激活）
│   │
│   ├── App.css                       # 全局样式表（~1445 行）
│   ├── App.tsx                       # 根组件（赛季选择 + 应用外壳）
│   ├── index.css                     # CSS 重置 + 自定义属性 + 基础排版
│   ├── main.tsx                      # 应用入口点
│   └── types.ts                      # 全部 TypeScript 类型定义
│
├── .dockerignore                     # Docker 构建排除
├── .gitignore                        # Git 忽略规则
├── Dockerfile                        # 多阶段 Docker 构建
├── eslint.config.js                  # ESLint 扁平配置
├── f1_fantasy_rules.md               # F1 Fantasy 详细计分规则文档
├── index.html                        # Vite HTML 入口
├── package.json                      # npm 项目配置
├── package-lock.json                 # 依赖锁文件
├── README.md                         # 中英文项目文档
├── start-dev.bat                     # Windows 开发启动脚本
├── tsconfig.json                     # 根 TypeScript 配置
├── tsconfig.app.json                 # 应用代码 TS 配置
├── tsconfig.node.json                # Vite 配置 TS 配置
└── vite.config.ts                    # Vite 构建配置
```

---

## 4. 核心架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        F1 Fantasy Local                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐                                                    │
│  │  Python 脚本  │  scripts/fetch_season_data.py                     │
│  │  FastF1+API  │─── 提取真实 F1 数据 ───┐                           │
│  └──────────────┘                         │                           │
│                                            ▼                           │
│                              ┌──────────────────────┐                 │
│                              │  src/data/seasons/   │                 │
│                              │  2020~2025.json      │                 │
│                              └────────┬─────────────┘                 │
│                                       │                               │
│                    ┌──────────────────┼──────────────────┐            │
│                    ▼                  ▼                   ▼            │
│  ┌─────────────────────┐  ┌──────────────────┐  ┌────────────────┐   │
│  │  seasonCatalog.ts   │  │ initial_assets   │  │ demoSeason2024 │   │
│  │  (加载赛季 JSON)     │  │ .ts (初始化资产)  │  │ (开发演示数据)  │   │
│  └────────┬────────────┘  └────────┬─────────┘  └───────┬────────┘   │
│           │                        │                     │            │
│           └────────────────────────┼─────────────────────┘            │
│                                    ▼                                  │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │                 GameContext.tsx (核心引擎)                      │     │
│  │                                                               │     │
│  │  • initializeStateForSeason()    — 赛季初始化                  │     │
│  │  • processCurrentRound()         — 主循环刻度                  │     │
│  │  • scoreManager()                — 经理计分                    │     │
│  │  • applyAiStrategy()             — AI 阵容优化                 │     │
│  │  • adjustPrices()                — 动态定价                    │     │
│  │  • buildOpeningRoster()          — 组合优化建队                │     │
│  │  • saveGame() / loadGame()       — 存档系统                    │     │
│  └──────┬───────────────────────────────────────────────────────┘     │
│         │                                                             │
│         ├──────────────────────────────────────────┐                  │
│         ▼                                          ▼                  │
│  ┌─────────────┐                         ┌─────────────────┐         │
│  │  useGame()  │                         │  localStorage   │         │
│  │  Hook       │                         │  (持久化存档)    │         │
│  └──────┬──────┘                         └─────────────────┘         │
│         │                                                             │
│         ▼                                                             │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │                      视图层 (Views)                           │     │
│  │  ┌──────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────┐  │     │
│  │  │Dashboard │ │ Transfer  │ │Standings  │ │SeasonSummary  │  │     │
│  │  │  .tsx    │ │  .tsx     │ │  .tsx     │ │   .tsx        │  │     │
│  │  └────┬─────┘ └─────┬─────┘ └────┬──────┘ └───────┬───────┘  │     │
│  │       └──────────────┴────────────┴───────────────┘           │     │
│  │                              │                                 │     │
│  │                              ▼                                 │     │
│  │  ┌──────────────────────────────────────────────────────┐     │     │
│  │  │           组件层 (Components)                         │     │     │
│  │  │  DriverCard | Sparkline | TrendArrow | ValueChip     │     │     │
│  │  │  ChipBadge  | Navigation                             │     │     │
│  │  └──────────────────────────────────────────────────────┘     │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │  工具层                                                       │     │
│  │  presentation.ts  — i18n、车队颜色、格式化、车手编号           │     │
│  │  types.ts         — 全部 TypeScript 类型                      │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. 根目录文件详解

### `index.html`
Vite 构建的 HTML 入口。引入 Google Fonts（Inter + Orbitron），挂载 `#root` 元素，加载 `/src/main.tsx`。

### `package.json`
npm 项目配置文件。定义了：
- **脚本**：`dev`（开发服务器）、`build`（生产构建）、`preview`（预览构建产物）、`lint`（代码检查）
- **依赖**：react 19.2.6、react-dom 19.2.6
- **开发依赖**：TypeScript 6.0.2、Vite 8.0.12、ESLint 10.3、@vitejs/plugin-react 6.0.1

### `vite.config.ts`
Vite 构建配置，仅引入 `@vitejs/plugin-react` 插件，使用默认设置。

### `tsconfig.json`
根 TypeScript 配置，引用 `tsconfig.app.json`（应用代码）和 `tsconfig.node.json`（构建工具代码）。

### `tsconfig.app.json`
应用代码 TypeScript 配置：
- 目标 ES2023，JSX react-jsx，模块解析 bundler
- 严格模式、无隐式 any、精确可选属性

### `tsconfig.node.json`
Vite 配置文件的 TypeScript 配置：
- 目标 ES2023，模块 NodeNext，包含 `vite.config.ts`

### `eslint.config.js`
ESLint 扁平配置（Flat Config），包含：
- TypeScript ESLint 推荐规则
- React Hooks 插件
- 忽略 `dist/` 目录

### `Dockerfile`
多阶段 Docker 构建：
- **构建阶段**：Node 20 Alpine，拷贝源码，执行 `npm ci && npm run build`
- **运行阶段**：Nginx Alpine，拷贝构建产物到 `/usr/share/nginx/html`，配置 SPA fallback 路由

### `.dockerignore`
排除 `node_modules`、`.git`、`dist` 等文件，加速 Docker 构建。

### `.gitignore`
标准 Node.js + React 项目的 Git 忽略规则。

### `start-dev.bat`
Windows 批处理快捷方式，等价于 `npm run dev`，用于在 Windows 环境快速启动开发服务器。

### `f1_fantasy_rules.md`
详细的 F1 Fantasy 计分规则文档。基于 FastF1 数据定义排位赛、冲刺赛、正赛、车队、技能芯片的计分规则。

### `README.md`
完整的双语（中文 + English）项目文档，包含功能列表、快速开始指南、技术栈、数据来源说明。

---

## 6. src/ 源代码详解

### 6.1 入口层

#### `src/main.tsx`
**应用的 JavaScript 入口点。** 使用 `React.StrictMode` 包裹，将 `<App />` 置于 `<GameProvider>` 内部启动。`GameProvider` 来自 `GameContext`，为整个组件树提供游戏状态。

#### `src/App.tsx`
**根组件**，负责两个互斥状态的管理：

1. **SeasonSelect（赛季选择）**：当 `selectedSeason === null` 时显示
   - 从 `seasonCatalog` 加载可用赛季列表
   - 以卡片网格展示每个赛季（年份、轮次数、赛道预览）
   - 如果 localStorage 中存在存档，显示"继续游戏"按钮
   - 点击赛季卡片或继续游戏按钮触发 `initializeStateForSeason()`

2. **AppShell（应用外壳）**：赛季激活后显示
   - **左侧边栏**：
     - 品牌标识（F1 Fantasy 标题）
     - `<Navigation>` 组件（Dashboard / Transfer / Standings 切换）
     - 预算/积分/转会次数显示（`<ValueChip>`）
     - 语言切换（EN / 中文）和自动导航开关
     - 保存 / 退出按钮
   - **右侧主区域**：
     - HUD 信息栏：剩余预算、总积分、剩余转会、已用芯片
     - "Load & Process Weekend" 按钮（触发 `processCurrentRound`）
     - 当前视图内容切换区域（4 个视图之一）
     - 赛季完成后自动切换到 `<SeasonSummary>`

---

### 6.2 状态管理层

#### `src/context/GameContext.tsx`（核心文件，~1936 行）
**整个应用的"大脑"，包含全部游戏状态和所有游戏逻辑。** `GameProvider` 组件管理 `GameState` 对象并通过 Context 暴露约 20 个 action 函数。

**暴露的核心 Actions：**

| Action | 功能 |
|--------|------|
| `initializeStateForSeason(year)` | 加载赛季数据，初始化车手/车队资产，创建 AI 经理 |
| `processCurrentRound()` | 主循环：模拟 1.4 秒加载后处理当前轮次 |
| `addDriver(driverId)` | 转会市场：签入车手 |
| `removeDriver(driverId)` | 转会市场：移出车手 |
| `addConstructor(constructorId)` | 转会市场：签入车队 |
| `removeConstructor(constructorId)` | 转会市场：移出车队 |
| `setDrsDriver(driverId)` | 设置 DRS Boost 目标（2x） |
| `setExtraDrsDrivers(driverIds)` | 设置 Extra DRS 目标（3x + 2x） |
| `activateChip(chipType)` | 激活技能芯片 |
| `setCurrentView(view)` | 切换当前视图 |
| `saveGame()` / `loadGame()` | localStorage 存档/读档 |
| `resetGame()` | 返回赛季选择 |
| `setLanguage(lang)` | 切换语言 |

**核心算法流程（`processCurrentRound`）：**

```
1. prepareAiManagers()
   └─ 每个 AI 执行 applyAiStrategy() 调整阵容

2. 验证人类玩家阵容合法性

3. scoreManager() × 4（人类 + 3 AI）
   └─ 排位赛分 + 冲刺赛分 + 正赛分 + 进站分 + DRS 倍率 + 转会罚分

4. adjustPrices() 调整所有资产价格
   └─ 基于 3 场滚动平均 vs 期望分（价格 × 系数）

5. 更新经理总分、芯片状态、保留转会次数

6. Limitless 芯片回滚处理

7. saveGame() 自动保存到 localStorage

8. 推进到下一轮 或 标记赛季完成
```

**AI 经理策略（`applyAiStrategy`）：**

| 风格 | 键名 | 策略描述 |
|------|------|----------|
| **狂热粉丝** | `fanatic` | 高估顶级车队（Ferrari, Red Bull, McLaren, Mercedes）；当某车手均分 >20 时使用 Extra DRS |
| **价值交易者** | `value` | 关注每百万积分的效率；转会成本超出免费次数时使用 Wildcard |
| **冷门猎手** | `underdog` | 偏好低价高潜车手；在混乱赛道（阿塞拜疆、新加坡、摩纳哥、中国）或车手超车收益高时使用 No Negative |

**组合优化建队（`buildOpeningRoster`）：**
枚举所有 5 车手 + 2 车队组合，在预算内最大化风格加权分函数。

**动态定价（`adjustPrices`）：**
每个资产价格根据 3 场滚动平均得分与期望得分的差值调整，最大幅度 ±\$1.5M。
- 车手期望分 = 价格 × 0.95
- 车队期望分 = 价格 × 1.08

#### `src/context/useGame.ts`
**React Context 消费者 Hook。** 一行封装：`useContext(GameContext)`。所有视图组件通过此 Hook 访问游戏状态和操作，无需手动引入 Context。

---

### 6.3 类型定义层

#### `src/types.ts`
**全局 TypeScript 类型定义文件。** 定义了以下核心类型：

| 类型 | 描述 |
|------|------|
| `SeasonData` | 完整赛季数据（年份、每轮比赛数据数组） |
| `RoundData` | 单轮比赛数据（赛道名、国家、排位赛、冲刺赛、正赛结果、进站时间） |
| `QualifyingResult` | 排位赛结果（名次、Q1/Q2/Q3 时间、DSQ 标记） |
| `SprintResult` | 冲刺赛结果（发车位、完赛名次、最快圈、DNF 标记） |
| `RaceResult` | 正赛结果（发车位、完赛名次、最快圈、DNF/DSQ 标记） |
| `DriverAsset` | 车手资产（ID、姓名、车队、价格、得分历史、车队颜色） |
| `ConstructorAsset` | 车队资产（ID、名称、两位车手、价格、得分历史、颜色渐变） |
| `ManagerTeam` | 经理阵容（姓名、是否为人类、AI 风格、车手列表、车队列表、预算、积分、芯片、DRS 设置） |
| `ManagerRoundResult` | 单轮经理计分结果（各项细分得分） |
| `GameState` | 完整应用状态（赛季、轮次、资产、经理、视图、存档） |
| `GameView` | 视图枚举（dashboard / transfer / standings / seasonSummary） |
| `ChipType` | 芯片类型枚举（drs_boost / extra_drs / autopilot / no_negative / limitless / wildcard） |
| `AiStyle` | AI 风格枚举（fanatic / value / underdog） |
| `Language` | 语言枚举（en / zh） |
| `ChipStatus` | 芯片状态（ready / armed / spent） |
| `PitStopData` | 进站数据 |

---

### 6.4 视图层

#### `src/views/Dashboard.tsx`
**主面板（默认视图）** — 比赛周末的核心信息展示：

- **Hero 面板**：总积分、剩余预算、剩余芯片数、下一站信息
- **Garage 区块**：
  - 2 张车队卡片（带车队颜色渐变背景）
  - 5 张车手卡片（含火花线图、DRS 标记、最近得分）
- **周末摘要**：领奖台、最快进站车队、DRS 回报、净得分、市场波动
- **弹窗模态框**：
  - **周末深度分析**：排位赛/正赛/进站/超车四张表格
  - **单车手得分分解**：可展开的 Q/S/R/P 各阶段得分明细

#### `src/views/Transfer.tsx`
**转会市场视图** — 阵容管理的核心界面：

- **左右分栏布局**：
  - **左侧**：当前阵容（5 个车手位 + 2 个车队位），可点击移出
  - **右侧**：转会市场列表，按价格排序，可点击签入
- **预算仪表**：显示已用/总预算，超额警告
- **转会计数器**：已用转会次数，超出免费次数显示罚分警告
- **DRS Boost 选择器**：为 5 名车手中的任一设置 2x 倍率
- **Extra DRS 对话框**：Extra DRS 芯片激活时，为 1 名车手设置 3x，另 1 名设置 2x
- **芯片激活面板**：所有 6 种芯片类型的状态与激活按钮
- **阵容合法性验证**：预算、车手数、车队数检查

#### `src/views/Standings.tsx`
**冠军积分榜视图**：

- **排行榜**：
  - 4 位经理的名次、姓名、趋势箭头（排名变化）、总积分
  - 人类玩家高亮显示
- **SVG 累计积分曲线图**：
  - 平滑贝塞尔曲线
  - 悬停提示框显示每轮具体积分
  - 人类玩家使用区分色
- **经理详情弹窗**：
  - 已用芯片、总得分/净得分
  - 每位车手/车队的得分分解（标记 Q/S/R/P 阶段标签）

#### `src/views/SeasonSummary.tsx`
**赛季结束总结页**：
- 冠军姓名和积分
- 玩家最终排名
- 最佳单轮表现
- 总处理轮次数
- "退出并开始新赛季"按钮

#### `src/views/RaceControl.tsx`
**比赛控制面板**（开发调试用，当前未在导航中路由）。

---

### 6.5 组件层

#### `src/components/Navigation.tsx`
**侧边栏三按钮导航。** 通过 `GameContext` 读写 `currentView`。按钮支持中英文双语标签，当前选中状态高亮。

#### `src/components/DriverCard.tsx`
**可复用的车手/车队卡片组件。** Props：

| Prop | 说明 |
|------|------|
| `title` | 卡片标题（车手/车队名） |
| `subtitle` | 副标题（车队名/车手列表） |
| `price` | 当前价格（\$M） |
| `points` | 总积分 |
| `lastScore` | 最近一场得分 |
| `scores` | 历史得分数组（用于火花线图） |
| `color` / `accentColor` | 车队颜色配置 |
| `isDrs` | 是否启用了 DRS Boost（青色呼吸动画） |
| `isExtraDrs` | 是否启用了 Extra DRS 3x |
| `onClick` | 点击回调 |
| `actionLabel` | 操作按钮文字 |

#### `src/components/Sparkline.tsx`
**SVG 火花线图组件。** 将历史得分数组渲染为迷你折线图，支持红色（下降）/ 青色（上升）/ 金色（稳定）三种配色。

#### `src/components/TrendArrow.tsx`
**排名趋势箭头组件。** 显示 ▲（上升）、▼（下降）、─（不变），附带变化数值。

#### `src/components/ValueChip.tsx`
**侧边栏数值显示芯片。** 带标签 + 数值的小型信息展示框，支持色调变体：neutral / positive / warning / accent。

#### `src/components/ChipBadge.tsx`
**芯片激活状态徽章。** 三种状态：Ready（可激活）、Armed（已激活待触发）、Spent（已使用）。

---

### 6.6 数据层

#### `src/data/seasonCatalog.ts`
**赛季 JSON 文件加载器。** 使用 Vite 的 `import.meta.glob` 动态扫描 `src/data/seasons/` 目录下的所有 `.json` 文件，构建 `{ year, label, rounds[], fileName }` 结构的赛季目录。供 `App.tsx` 的赛季选择界面使用。

#### `src/data/initial_assets.ts`
**车手/车队种子数据与资产初始化器。**
- **20 个车手种子数据**：基于 2024 赛季真实价值的初始价格
- **~12 个车队种子数据**：覆盖所有车队名称变体（Red Bull Racing → RB → AlphaTauri → Toro Rosso；Sauber → Alfa Romeo → Stake → Kick Sauber）
- **`buildInitialDrivers(seasonData, roundData)`**：扫描赛季第一轮数据，发现实际参赛车手，从种子数据或后备推算分配初始价格
- **`buildInitialConstructors(seasonData, roundData)`**：同上逻辑，为车队分配初始价格

#### `src/data/demoSeason2024.ts`
**合成演示赛季**（4 轮）。用于开发测试，包含手动构建的巴林、沙特阿拉伯、澳大利亚、中国四站数据。

#### `src/data/seasons/2020.json` ~ `2025.json`
**真实历史赛季数据**（JSON 格式）。由 `scripts/fetch_season_data.py` 生成，每个文件包含该赛季所有轮次的完整比赛数据：

```typescript
// 赛季 JSON 结构
[
  {
    "roundNumber": 1,
    "trackName": "Bahrain International Circuit",
    "country": "Bahrain",
    "qualifying": [
      { "position": 1, "driverName": "Max Verstappen", "constructorName": "Red Bull Racing",
        "q1Time": "1:29.179", "q2Time": "1:28.751", "q3Time": "1:28.197", "noTimeSetInQ1": false, "dsq": false }
    ],
    "sprint": [  // 可选：冲刺赛周才有
      { "gridPosition": 1, "finishPosition": 2, "driverName": "...", "constructorName": "...",
        "fastestLap": false, "dnf": false }
    ],
    "race": [
      { "gridPosition": 1, "finishPosition": 1, "driverName": "...", "constructorName": "...",
        "fastestLap": true, "dnf": false, "dsq": false }
    ],
    "pitStops": [
      { "driverName": "...", "constructorName": "...", "totalTime": "23.456", "rank": 1 }
    ]
  }
]
```

---

### 6.7 工具库层

#### `src/lib/presentation.ts`
**UI 辅助工具集：**

| 函数/数据 | 说明 |
|-----------|------|
| `copyText(en, zh)` | 根据 `activeLanguage` 返回对应语言文本（双语系统核心） |
| `activeLanguage` | 模块级语言状态变量（从浏览器检测，可通过设置切换） |
| `TEAM_COLORS` | 每支车队的颜色定义：`{ primary, secondary, gradient, altPrimary?, altSecondary? }` |
| `SAUBER_COLORS_BY_SEASON` | Sauber 车队专属的按赛季变化的配色方案 |
| `getConstructorColors(name, year?)` | 获取车队颜色（Sauber 特殊处理赛季变体） |
| `getTeamColorForDriver(driverName, constructors?, year?)` | 获取车手所属车队的颜色 |
| `DRIVER_NUMBERS` | 车手编号映射表 |
| `formatPrice(price)` | 价格格式化（\$XX.XM） |
| `formatPoints(points)` | 积分格式化 |
| `getDriverDisplayName(fullName)` | 车手简称转换（如 "Max Verstappen" → "VER"） |

---

### 6.8 样式层

#### `src/index.css`
**CSS 重置 + 自定义属性 + 基础排版。** 定义了：
- CSS 自定义属性（颜色、阴影、间距、圆角）
- 深色主题色彩系统（navy #15151e、red #e10600、neon green、cyan）
- @font-face 或字体栈定义
- 基础排版规则（body、h1-h6、button 等）

#### `src/App.css`
**全局应用样式表（~1445 行）。** 涵盖：
- 赛季选择界面布局和动画
- 应用外壳（侧边栏 + 主区域）布局
- HUD 信息栏样式
- 所有视图（Dashboard、Transfer、Standings、SeasonSummary）的特定样式
- 所有组件（DriverCard、Sparkline、Navigation、ValueChip、TrendArrow）的样式
- 弹窗模态框样式
- 动画定义：
  - **pulse**：绿色圆点脉冲（保存指示器）
  - **drsBreathe**：青色辉光呼吸（DRS 激活车手）
  - **spin**：旋转（加载动画）
  - **warningGlow**：红色脉冲警告（预算超额）
- 响应式媒体查询

---

### 6.9 静态资源层

#### `src/assets/hero.png`
赛季选择页面的英雄图。

#### `src/assets/react.svg`
React 标志 SVG。

#### `src/assets/vite.svg`
Vite 标志 SVG。

---

## 7. scripts/ 数据脚本详解

### `scripts/fetch_season_data.py`（当前在用）
**核心数据提取脚本。** 使用 FastF1 Python 库从 F1 官方数据源提取真实比赛数据，输出到 `src/data/seasons/{year}.json`。

**工作流程：**
1. 使用 FastF1 加载指定赛季的完整赛程
2. 对于每个比赛周，加载排位赛、冲刺赛（如有）、正赛数据
3. 使用 OpenF1 API 回退获取 FastF1 中不完整的进站和最快圈数据
4. 将结构化数据写入 JSON 文件
5. 支持增量提取（重新运行时仅提取缺失的轮次）

**依赖 (Python):**
- `fastf1`：F1 官方数据访问库
- `requests` + `certifi`：OpenF1 API HTTP 请求
- `pandas`：数据处理

### `scripts/fetch_season_data_old.py`
**旧版数据提取脚本。** 仅使用 FastF1 库，无 OpenF1 回退，结构更简单。保留用于参考。

### `scripts/f1_cache/`
FastF1 pickle 缓存目录，按赛季/比赛周组织子目录，包含 `.ff1pkl` 文件。

---

## 8. public/ 公共资源

### `public/favicon.svg`
网站图标 SVG（紫色渐变）。

### `public/icons.svg`
SVG 图标精灵表，包含 Bluesky、Discord、GitHub、X (Twitter) 的图标。

---

## 9. 配置文件详解

### `.claude/settings.local.json`
Claude Code 本地权限设置。定义允许自动执行的命令和工具。

### `f1_cache/fastf1_http_cache.sqlite`
FastF1 库的 HTTP 响应缓存（SQLite 格式），加速数据重新提取。

### `output/`
预留输出目录（当前为空）。

---

## 10. CI/CD 与部署

### `.github/workflows/release.yml`
**GitHub Actions 发布流水线：**
- **触发条件**：推送 `v*` 标签
- **步骤**：
  1. Checkout 代码
  2. 设置 Node 20
  3. `npm ci && npm run build`
  4. 将 `dist/` 打包为 `f1-fantasy-{tag}.zip`
  5. 创建 GitHub Release 并上传 zip 附件

---

## 11. 数据流全景

```
┌──────────────────────────────────────────────────────────────────┐
│                        数据生成（离线）                            │
│                                                                   │
│  FastF1 API ─────────┐                                            │
│                      ├──→ fetch_season_data.py ──→ seasons/*.json │
│  OpenF1 API (降级) ──┘                                            │
└──────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────┐
│                        应用启动                                    │
│                                                                   │
│  main.tsx                                                        │
│    └─→ GameProvider                                               │
│         └─→ App.tsx                                               │
│              ├─ (空状态) → SeasonSelect                           │
│              │    └─→ seasonCatalog.ts 加载 seasons/*.json         │
│              │    └─→ 用户选择赛季                                 │
│              │                                                     │
│              └─→ initializeStateForSeason(year)                   │
│                   ├─ 加载 {year}.json                              │
│                   ├─ buildInitialDrivers／Constructors             │
│                   ├─ buildOpeningRoster × 4（buildAI 阵容）       │
│                   └─→ AppShell                                    │
│                        └─→ 四个视图切换                           │
└──────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────┐
│                       游戏循环                                    │
│                                                                   │
│  用户点击 "Process Weekend"                                       │
│    └─→ processCurrentRound()                                     │
│         ├─ AI 策略应用 (applyAiStrategy)                          │
│         ├─ 人类阵容验证                                           │
│         ├─ 计分引擎 (scoreManager) × 4                            │
│         │   ├─ 排位赛 (qualifying)                                │
│         │   ├─ 冲刺赛 (sprint)                                    │
│         │   ├─ 正赛 (race)                                        │
│         │   ├─ 进站 (pitStop)                                     │
│         │   └─ 芯片倍率 / 罚分                                    │
│         ├─ 动态定价 (adjustPrices)                                │
│         ├─ 状态更新 + 自动存档                                    │
│         └─ 推进到下一轮                                           │
└──────────────────────────────────────────────────────────────────┘
```

---

## 12. 核心算法

### 12.1 计分引擎 (`scoreManager`)

**排位赛：**
- P1 得 10 分，递减至 P10 得 1 分
- Q1 未设时间或被 DSQ：-5 分

**冲刺赛：**
- P1-P8 分别得 8/7/6/5/4/3/2/1 分
- 发车位相对完赛位的变化（上限 -10）
- 最快圈：+5 分
- DNF：-10 分

**正赛：**
- 标准 F1 积分：25/18/15/12/10/8/6/4/2/1
- 发车位相对完赛位的变化（上限 -10）
- 最快圈：+10 分
- DNF/DSQ：-20 分

**车队计分：**
- 两位车手的排位 + 冲刺 + 正赛分之和（不含最快圈奖励）
- Q2/Q3 晋级奖励
- 进站排名分：P1=+15, P2=+10, P3=+5

**芯片效果：**
- **DRS Boost (2x)**：每周应用于一名车手
- **Extra DRS (3x+2x)**：一名车手 3x，另一名 2x
- **Autopilot**：DRS 自动分配给最高分车手
- **No Negative**：所有得分下限为 0
- **Limitless**：移除预算上限，周末后回滚
- **Wildcard**：无限免费转会，变更为永久

### 12.2 动态定价 (`adjustPrices`)

```
rolling_avg = 最近 3 场得分平均值
expected = price × coefficient (车手 0.95, 车队 1.08)
delta = rolling_avg - expected
price_change = clamp(delta / coefficient, -1.5, 1.5)  // 单位: $M
new_price = max(price + price_change, floor_price)
```

### 12.3 AI 建队算法 (`buildOpeningRoster`)

组合优化问题：枚举所有可能的 5 车手 + 2 车队组合，在预算约束下最大化：
```
score = Σ(driver.recentScore × styleWeight) + Σ(constructor.recentScore × styleWeight)
```
风格权重根据 AI 风格（fanatic / value / underdog）进行调整。

### 12.4 存档系统

使用 `localStorage`，键名基于赛季年份。存档格式为版本化 JSON：
```
localStorage["f1-fantasy-save-{year}"] = JSON.stringify(gameState)
```
每次处理完一轮自动保存，启动时可恢复。

---

## 13. 外部依赖

### 运行时（生产环境）

| 包名 | 版本 | 用途 |
|------|------|------|
| `react` | 19.2.6 | UI 框架 |
| `react-dom` | 19.2.6 | DOM 渲染 |

### 开发环境

| 包名 | 版本 | 用途 |
|------|------|------|
| `typescript` | 6.0.2 | 类型检查 + 编译 |
| `vite` | 8.0.12 | 构建工具 + 开发服务器 |
| `@vitejs/plugin-react` | 6.0.1 | Vite React 插件 |
| `eslint` | 10.3 | 代码检查 |
| `@typescript-eslint/*` | — | ESLint TypeScript 规则 |
| `eslint-plugin-react-hooks` | — | React Hooks 检查规则 |
| `@types/react` | — | React 类型定义 |
| `@types/react-dom` | — | ReactDOM 类型定义 |

### Python 脚本（数据生成，非应用依赖）

| 包名 | 用途 |
|------|------|
| `fastf1` | F1 官方数据访问 |
| `requests` | HTTP 客户端（OpenF1 API） |
| `pandas` | 数据处理 |
| `certifi` | SSL 证书 |

### 外部服务（数据生成时使用）

| 服务 | 用途 |
|------|------|
| FastF1| 排位赛、冲刺赛、正赛数据 |
| OpenF1 API | 进站 + 最快圈数据（FastF1 数据不完整时降级使用） |

---

> 📅 文档生成日期：2026-06-11
> 📦 项目版本：v0.2.0
> 🏷️ Git 分支：master
