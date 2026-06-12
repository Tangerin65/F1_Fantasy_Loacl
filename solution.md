# solution.md

> 目的：根据 `bugs.md` 中列出的已知问题，制定“完整、可落地”的修改方案（只产出方案文档，不直接改代码）。
> 
> 范围：本方案覆盖 UI 展示（车号/颜色/名称）、数据归一化（normalize）与转会市场“实体去重”一致性。

---

## 总览（按 bugs.md 顺序）

bugs.md 共包含 4 大类问题：

1. **车号未显示**（缺失车手缩写到号码的映射）
2. **车队颜色重构**（各年份车队配色需要与文档一致）
3. **车队名称错误**（Sauber/Alfa Romeo Sauber 规范命名不一致）
4. **转会市场去重 Bug**（同一车队实体的多个名称同时存在，原因是归一化/合并规则缺失）

---

## 1. 车号未显示（# 车号未显示）

### 1.1 现象复述（来自 bugs.md）
- **2018**：
  - VET, RAI, GRO, VAN, HAR, ERI, SIR 对应车号未显示
- **2019**：
  - KVY, GIO, KUB 对应车号未显示
- **2020**：
  - KVY, AIT, FIT 对应车号未显示
- **2021**：
  - MAZ, KUB 对应车号未显示

### 1.2 根因判断（结合当前代码结构）
根据代码可推断：
- 车号显示依赖 `src/lib/presentation.ts` 的 `DRIVER_NUMBERS` 映射。
- 当前 `DRIVER_NUMBERS` 只包含部分现代常见车手缩写，**缺少** bugs.md 指定的多位历史车手缩写。
- `getDriverNumber(abbreviation)` 对未命中的缩写会返回 `'--'`，因此 UI 中就“车号未显示”。

### 1.3 修改目标（验收口径）
- bugs.md 列出的所有缩写，在对应赛季数据出现时，`getDriverNumber()` 返回正确号码。
- UI 展示不再出现 `'--'`（至少针对列出的缩写不再出现）。

### 1.4 建议的修改方案

#### A) 扩展车手号码映射表
- 修改文件：`src/lib/presentation.ts`
- 扩展 `DRIVER_NUMBERS: Record<string, string>`，补齐以下缩写：
  - `VET` / `RAI` / `GRO` / `VAN` / `HAR` / `ERI` / `SIR`
  - `KVY` / `GIO` / `KUB`
  - `AIT` / `FIT`
  - `MAZ`

> 注：号码来源建议使用官方赛季车手号码（或你当前数据源/规则的既有映射标准）。
> 由于本任务要求“不改代码”，这里给出的是“补齐映射项”的工程性要求。

#### B) 统一大小写与缩写格式（防御性）
- 确保 `getDriverNumber()` 在匹配时对输入缩写做 `toUpperCase()`（如果当前数据有大小写差异风险）。
- 修改点仍建议集中在 `src/lib/presentation.ts`。

#### C) 验证清单（不需要你改代码的情况下也可用于自检）
- 在 UI 的转会市场或车库卡片中，切到涉及这些车手缩写的赛季（例如 2018/2019/2020/2021）。
- 观察对应车手卡片标题是否显示：`<number> <fullName>`。

---

## 2. 车队颜色重构（# 车队颜色重构）

### 2.1 现象复述（来自 bugs.md）
bugs.md 给出了 2018-2025 各年份车队配色（包括 base/edge/以及部分赛季渐变组合）。

例如：
- 2018 Mercedes：`#00D2BE`
- 2018 Ferrari：`#DC0000、 #FFFFFF`
- 2024 RB：`#1434CB、 #FFFFFF、 #E10600、 #C0C7D1`
- 2025 Kick Sauber：`#00FF5F、 #111111、 #FFFFFF`

### 2.2 根因判断
结合当前代码：
- `src/lib/presentation.ts` 中的颜色体系目前是：
  - `TEAM_COLORS_BASE`：少量车队固定调色板（如 Red Bull / Ferrari / McLaren / Mercedes / Aston Martin / Alpine / Williams / RB / Haas）
  - `SAUBER_COLORS`：仅对 Sauber 的某些年份做了渐变特殊处理（2022-2025）
  - 其他年份/其他车队的配色大概率**不覆盖 bugs.md 的完整矩阵**。
- bugs.md 明确要求“颜色重构”，说明现有实现无法满足“按赛季精确还原”的目标。

### 2.3 修改目标（验收口径）
- 任意选择赛季（2018-2025）时：
  - 转会市场车队卡背景
  - 车库（Garage lineup）中车队卡背景
  - （若存在）车队相关其他 UI
a) 都应使用 bugs.md 指定的配色。
- 至少覆盖 bugs.md 给出的所有车队/年份组合；不存在“回退到默认 palette”的情况（除非 bugs.md 未覆盖）。

### 2.4 建议的修改方案

#### A) 将颜色数据提升为“年份维度的结构化配置”
- 建议新增一个数据结构（或数据文件）：
  - `TEAM_COLORS_BY_SEASON: Record<number, Record<CanonicalTeamName, {base:string, edge:string, text?:string, gradient?:string}>>`
- 修改文件范围：
  - 以 `src/lib/presentation.ts` 为主（目前颜色逻辑就在这里）。
  - 若希望降低维护成本，可新建 `src/data/teamColors.ts`，然后 `presentation.ts` 引入。

#### B) 对渐变/多色支持进行统一
bugs.md 的条目看起来是多色集合（至少 base/edge 或更多）。
建议：
- 将每条配置明确成：
  - base：用于渐变起点
  - edge：用于渐变终点
  - 其余颜色：用于 text/或自定义 gradient 多段渐变
- 约束：如果你只需要两端渐变（base/edge），则其余颜色可作为备用 text 或扩展 gradient。

#### C) 明确“canonical team name”与颜色索引之间的关系
颜色索引必须使用**同一套规范车队名**（和第 3/4 部分的 normalizeTeamName/constructorName 规则一致）。
- 否则会出现：
  - normalize 把车队归并成 `Alfa Romeo Sauber`，但颜色表仍按 `Sauber` 存储，最终走默认色。

### 2.5 验证清单
- 选任意 2-3 个赛季（例如 2018、2021、2024、2025）。
- 打开 Transfer 页面：
  - 车队列表中，每一支构造器卡背景颜色是否与 bugs.md 对应颜色一致。
- 打开 Dashboard：
  - 车库 garage 中构造器卡背景颜色是否一致。

---

## 3. 车队名称错误（# 车队名称错误）

### 3.1 现象复述（来自 bugs.md）
- **2018-2021**：
  - Sauber -> Alfa Romeo Sauber

### 3.2 根因判断
结合当前归一化逻辑：
- `src/lib/presentation.ts` 的 `normalizeTeamName(team, season?)`：
  - 遇到 `sauber`、`alfa romeo`、`kick`、`stake` 等会统一返回 `Sauber`。
- `src/data/initial_assets.ts` 的 `normalizeName(raw, season?)`：
  - 也把 `alfa romeo / kick / stake / sauber` 归并到了 `Sauber`。
- 因此 UI 显示与数据归一化的“规范名”都是 `Sauber`，与 bugs.md 要求不一致。

### 3.3 修改目标（验收口径）
- 在 2018-2021 赛季：
  - 与 Sauber 实体相关的车队名称展示必须显示为 `Alfa Romeo Sauber`（至少在 UI 卡片标题/副标题处）。

### 3.4 建议的修改方案

#### A) 调整 normalizeTeamName 的 canonical 输出
- 修改文件：`src/lib/presentation.ts`
- 修改逻辑：
  - 当 `lower` 命中 `alfa romeo / sauber / kick / stake` 等，且 `season` 在 2018-2021 范围内：返回 `Alfa Romeo Sauber`。
  - 当 season 超出范围：返回你当前期望的 canonical（例如 `Sauber`、`Stake` 或 `Kick Sauber`，取决于你的规则体系；bugs.md 只点名 2018-2021）。

#### B) 同步修改 initial_assets.ts 和评分归一化逻辑
因为 constructor 资产和评分需要匹配同一 canonical 名：
- 修改文件：
  - `src/data/initial_assets.ts`：`normalizeName()`
  - `src/context/GameContext.tsx`：其中 `buildConstructorScoreMap()` 内部有一份局部的 `normalizeName`（目前同样把 Sauber 类归到 `Sauber`）

> 若只改 UI normalize 而不改评分/资产 normalize，会导致：
> - 颜色/名称展示对了，但评分找不到对应 constructor key，出现总分异常或 pit stop 排名错误。

### 3.5 验证清单
- 选择 2018、2019、2020、2021：
  - 打开 Dashboard 的 garage（车队卡片）。
  - 确认显示为 `Alfa Romeo Sauber`。
- 打开 Transfer：
  - 确认市场车队卡片显示与该赛季 canonical 名一致。

---

## 4. 转会市场-全部车队中“一个车队实体多个名称同时存在”的 Bug

### 4.1 现象复述（来自 bugs.md）
问题核心是：在转会市场“全部车队”里，同一实体出现多个名字并存：

- **2018**：
  - Renault & Alpine：应只有 Renault
  - Racing Point 和 Force India：应只有 Force India
- **2019**：
  - Renault & Alpine：应只有 Renault
  - Racing Point 和 Aston Martin：应只有 Racing Point
- **2020**：
  - Renault & Alpine：应只有 Renault
  - Racing Point 和 Aston Martin：应只有 Racing Point

### 4.2 根因判断
从当前架构看，转会市场的“全部车队”列表来源是 `state.constructors`。
- `state.constructors` 由 `buildInitialConstructors(entry.data)` 生成。
- `buildInitialConstructors` 会对 `pitStops` 里的 `constructor` 字符串做 `normalizeName(stop.constructor, seasonData.season)` 去重。
- 目前 normalizeName：
  - `alpine` 单独映射到 `Alpine`
  - 对 Renault/Racing Point/Force India/Aston Martin 的合并规则可能不完整
  - 所以出现多个 canonical key 对应同一实体。

### 4.3 修改目标（验收口径）
- 选择赛季：
  - 2018：市场中 Renault 实体只保留 `Renault`；Racing Point/Force India 只保留 `Force India`。
  - 2019/2020：Racing Point/ Aston Martin 只保留 `Racing Point`；Renault/Alpine 只保留 `Renault`。
- 转会市场“全部车队”不再展示同一实体的多个名字。

### 4.4 建议的修改方案

#### A) 在 normalizeName / normalizeTeamName 中补齐“赛季条件归并”规则
你需要在至少 3 个位置保持同一套 canonical 逻辑：

1. `src/data/initial_assets.ts`：`normalizeName(raw, season?)`
2. `src/lib/presentation.ts`：`normalizeTeamName(team, season?)`
3. `src/context/GameContext.tsx`：`buildConstructorScoreMap()` 内部 `normalizeName(raw)`

归并规则建议：
- Renault & Alpine：
  - 在 `season <= 2020`（bugs.md 覆盖到 2020）：
    - 若 `lower.includes('alpine')` 或包含 Alpine 相关命名 -> 归并到 canonical `Renault`
    - 若包含 Renault -> 归并到 `Renault`
- Racing Point / Force India / Aston Martin：
  - 2018：
    - Racing Point 与 Force India -> canonical 设为 `Force India`
  - 2019-2020：
    - Racing Point 与 Aston Martin -> canonical 设为 `Racing Point`

> 注意：canonical 名的具体字符串（例如“Force India”是否保持原格式大小写）应与颜色表（第 2 部分）与 UI 展示保持一致。

#### B) 同时处理 drivers/constructors 的队名归一化一致性
- 驱动车手在数据里可能也会体现 team 字符串（例如 `Renault` vs `Alpine`）。
- 若 driver.team 的 normalize 与 constructor normalize 不一致，会导致：
  - 车手卡展示的队伍颜色/名称与车队卡不匹配。
- 因此：在 normalize driver.team 的路径上，也应复用同一 canonical 规则。

### 4.5 验证清单
- 打开 Transfer -> 构造器市场。
- 依次选择：2018、2019、2020。
- 检查：
  - 市场列表中是否只出现一个 Renault 实体名称。
  - 市场列表中是否只出现一个 Racing Point/Force India 实体名称（按赛季规则）。

---

## 5. 交付物与回归测试建议（强烈建议）

### 5.1 最小回归集
为了覆盖上述 4 类问题，建议至少验证：
- 赛季：2018、2019、2020、2021、2024、2025（颜色覆盖面更大）。
- 页面：Dashboard、Transfer。

### 5.2 验收判定标准（可复制到 PR 描述）
- [ ] 车号：bugs.md 列出的缩写在对应赛季不再显示 `'--'`。
- [ ] 颜色：Transfer 与 Dashboard 中构造器卡/相关 UI 背景颜色与 bugs.md 对应年份一致（或按你定义的渐变规则一致）。
- [ ] 名称：2018-2021 赛季 Sauber 实体展示为 `Alfa Romeo Sauber`。
- [ ] 去重：Transfer -> constructors 市场中，不再出现 Renault/Alpine、Racing Point/Force India、Racing Point/Aston Martin 的重复实体。

---

## 6. 风险与注意事项（不涉及代码修改但影响落地）
- canonical 命名一旦变化（如 `Sauber` -> `Alfa Romeo Sauber`），必须同步影响：
  - 构造器资产生成（initial_assets）
  - 构造器评分（GameContext buildConstructorScoreMap）
  - 颜色与 UI 展示（presentation normalize + getTeamColors）
- 颜色表若索引 canonical name 不一致，会导致大量回退到 fallback palette。


