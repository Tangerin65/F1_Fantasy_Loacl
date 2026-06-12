# 引入今日最佳车手 (Driver of the Day) 及重构数据获取顺序实现方案

根据您的反馈与更正，本方案已更新。方案详细规划了如何在现有架构中新增“今日最佳车手 (DOTD)”数据（预留字段，人工填写）、调整进站数据 (Pit Stops) 和最快圈速 (Fastest Lap) 的获取优先级为 `Jolpica -> FastF1 -> OpenF1`、精简控制台日志输出，并更新游戏得分机制（车手专属加分）及前端展示。

---

## 🛠 Proposed Changes (代码修改计划)

### 1. 数据结构更新 (Data Structures)

#### [MODIFY] [types.ts](file:///d:/Tangerin/Personal/Code/F1%20Fantasy/src/types.ts)
需要更新 JSON 数据类型定义，以支持新的 DOTD 字段预留位。

*   在 `RoundData` 接口的 `race` 对象中，新增 `driverOfTheDay: string | null;` 字段（记录获得 DOTD 的车手缩写，如 "VER"）。
*   该字段在数据抓取时将默认填充为 `null`，后续交由**人工填写**。

### 2. 数据获取脚本重构 (Data Fetching Script)

#### [MODIFY] [fetch_season_data.py](file:///d:/Tangerin/Personal/Code/F1%20Fantasy/scripts/fetch_season_data.py)
重构获取逻辑，规范获取顺序，同时精简控制台日志，仅保留获取进度与成败信息。

*   **精简日志输出机制**：
    *   移除所有不必要的数据明细打印（如果存在）。
    *   数据完整性检查需严格覆盖：排位赛 (Qualifying)、冲刺赛 (Sprint，如有)、正赛 (Race)。
    *   控制台仅打印各阶段的获取进度信息以及明确的 `Success (成功)` 或 `Failed (失败)` 状态。
*   **新增 Jolpica 通讯层**：
    *   新增 `get_jolpica_json(endpoint, params)` 函数，用于请求 Jolpica API。
*   **重构最快圈获取 (Fastest Lap)**：
    *   修改 `extract_fastest_lap_driver_with_fallback`，顺序调整为：
        1. 尝试 Jolpica
        2. 尝试 FastF1
        3. 尝试 OpenF1
        4. 全失败则标记此项获取失败。
*   **重构进站数据获取 (Pit Stops)**：
    *   修改 `extract_pit_stops_with_fallback`，顺序同样调整为：`Jolpica -> FastF1 -> OpenF1`。
*   **DOTD 字段预留**：
    *   由于 DOTD 改为纯人工填写，不需要发起 API 请求。
    *   在 `extract_race` 返回的字典结构中，直接硬编码 `driverOfTheDay: None`。生成 JSON 时会转化为 `null`。

### 3. 游戏得分机制修改 (Game Mechanics)

#### [MODIFY] [GameContext.tsx](file:///d:/Tangerin/Personal/Code/F1%20Fantasy/src/context/GameContext.tsx)
修改计分逻辑，使其在处理每站比赛结果时，能够识别手工填写的 DOTD 并给予 **+10 分** 奖励，且明确规定**该奖励仅限车手，不计入车队积分**。

*   **修改 `scoreRaceDriver` 函数**：
    *   增加入参 `driverOfTheDay: string | null`。
    *   新增判定逻辑：`const dotdPoints = result.driver === driverOfTheDay ? 10 : 0;`。
    *   **关键修改**：车队的正赛积分依赖 `scoreRaceDriver` 返回的 `withoutFastestLap`（此字段原意为排除个人加分项以供车队计算）。为了确保车队不获得 DOTD 加分，需要将原有的 `withoutFastestLap` 改名为 `baseRacePoints`，或者增加一个新的返回值对象结构：
        *   `total`: 基础分 + 位置分 + 最快圈分 + **DOTD分** + 退赛罚分
        *   `constructorApplicablePoints`: 基础分 + 位置分 + 退赛罚分 (注意：不含最快圈，也**不含 DOTD**)
        *   `fastestLapPoints`: 最快圈分
        *   `dotdPoints`: DOTD分
*   **修改 `buildConstructorScoreMap` 函数**：
    *   在调用 `scoreRaceDriver` 计算车队正赛得分时，确保累加的是上述安全的 `constructorApplicablePoints`，从而彻底隔离 DOTD 分数对车队的影响。
*   **修改 `getRaceBreakdown` 函数**：
    *   增加入参 `driverOfTheDay: string | null`。
    *   如果 `result.driver === driverOfTheDay`，则向明细列表中推入新条目：`{ label: 'Driver of the Day', labelZh: '今日最佳车手', points: 10 }`。
*   **修改 `buildDriverScoreMap` 函数**：
    *   在调用计分和拆解函数时，正确传入 `roundData.race.driverOfTheDay`。

### 4. 前端视图呈现 (Frontend UI)

#### [MODIFY] [Dashboard.tsx](file:///d:/Tangerin/Personal/Code/F1%20Fantasy/src/views/Dashboard.tsx)
在赛后周末总结面板中展示 DOTD 荣誉。

*   **更新 Weekend summary (周末总结)**：
    *   在现有的 `report-grid` (包含 Podium P1, Fastest pit team 等) 中，新增一个 `report-card`。
    *   标题：`<span>{copyText('Driver of the Day', '最佳车手')}</span>`。
    *   数值：通过遍历 `lastRoundData.race.results` 找到匹配 `lastRoundData.race.driverOfTheDay` 的车手全名；若 JSON 中尚未手工填写（值为 `null`），则显示 `'N/A (待补全)'` 或 `'Pending'`。

#### [MODIFY] [f1_fantasy_rules.md](file:///d:/Tangerin/Personal/Code/F1%20Fantasy/f1_fantasy_rules.md) (可选)
*   去除文件中声明“本游戏积分规则中不包含今日最佳车手加分”的警告块。
*   在“正赛额外加减分”章节中，正式加入 Driver of the Day 的加分规则（车手获得 +10 分，不计入车队总分）。

---

## 🔬 Verification Plan (验证计划)

当开发者完成上述修改后，需执行以下验证步骤：

1. **测试脚本运行**：运行 `python scripts/fetch_season_data.py --season 2024 --start-round 1 --end-round 1 --force`。
2. **日志验证**：确认控制台**没有**输出庞大的排位赛/正赛 JSON 数据，仅输出了整洁的 "Loading...", "Success", "Failed" 进度和结果日志。
3. **JSON 结构检查**：查看 `src/data/seasons/2024.json`，确认 Round 1 的 `race` 节点下出现了预留的 `driverOfTheDay: null` 字段。
4. **人工补全测试**：手动将 `driverOfTheDay` 修改为某位车手（例如 "SAI"）。
5. **车队隔离验证**：启动前端应用，处理该站比赛。验证该车手的个人得分增加了 10 分，但**其所属车队（Constructor）的总分并未包含这 10 分**。
6. **UI 验证**：检查 Dashboard 面板的周末总结区域，确认 Driver of the Day 栏目正确呈现了人工填写的车手名字。
