# Training 五个新模板指标与开发计划

## 1. 目标

为 Training 模式新增以下五个动作模板：

1. 开合跳
2. 同一侧连续弓步蹲
3. 俯卧撑
4. 单腿站立
5. 双脚基础跳绳

本计划只评价动作本身做得怎么样：

- 完整动作或可用片段识别只负责找到可以分析的数据，不作为评分指标。
- 从动作内部计算少量、容易解释的角度、位置和稳定性指标。
- 报告显示实际表现、简单目标，以及“哪里做得好、哪里需要调整”。
- 不因视频长短、保持时长、动作总次数、标准动作次数或绝对速度不同而直接加减分。

五个新模板和现有五个 Training 模板都不得把“保持多久”或“完成多少次”作为评分标准，也不在儿童报告中展示这类达标统计。

## 2. 当前系统约束

当前 Pose2D Training 分析链路为：

1. `PoseAutoAnalyzer.tsx` 以约 12 FPS 扫描上传视频，最多采样 420 帧。
2. MediaPipe Pose 生成逐帧关键点、`FrameSample[]` 和 Training 时序帧。
3. `aggregateTrainingSequence()` 根据时序帧计算模板指标。
4. `calculateRealScore()` 按模板中的 `target` 或 `range` 规则评分。
5. 报告保存 `saved_metrics`、`timeline_data` 和最终评分。

开发时需要接受以下事实：

- 视频长度不固定，不能以总次数或总时长作为主要质量指标。
- 12 FPS 每帧约间隔 0.083 秒，不适合判断特别细的毫秒级同步差。
- 正面视频适合比较左右对称、脚距、骨盆水平和身体横向晃动。
- 侧面视频适合计算关节屈伸角、躯干前倾和身体直线。
- MediaPipe 是二维投影，指标阈值应保持宽松，避免把镜头角度误差当成动作错误。

## 3. 设计原则

### 3.1 完整动作只负责找到可评估片段

完整动作识别用于找到动作的开始、峰值和结束。它是内部取样工具，不生成“完成次数”“标准次数”“达标比例”或任何次数得分。

重复动作的内部片段结构只需要：

- `startFrame`
- `peakFrame`
- `endFrame`
- `isComplete`

完整片段用于观察一个动作内部是否下到位、伸到位和保持正确姿态。宽松识别阈值应尽量保留做得不够标准的动作，让后续几何指标指出具体问题。若没有足够的可评估片段，报告显示“暂时无法评分”和拍摄或动作建议，不生成误导性分数。

### 3.2 识别阈值应比评分阈值宽松

动作识别不能只识别标准动作，否则错误动作会直接消失，用户也看不到问题。

例如俯卧撑：

- 动作识别：肘角下降到 130 度以下即可认为进入底部阶段。
- 动作评分：底部肘角目标为 70-105 度。

这样浅俯卧撑仍会被识别为一个动作，但 Execution 会因为下降不足而扣分。

### 3.3 使用简单且稳定的基础计算

首版只使用以下计算：

- 三点关节角
- 点到垂直线或身体线的偏移
- 两点距离
- 肩宽、躯干长度或腿长归一化
- 中位数
- 标准差
- 必要时使用简单的相对波动值

标准差和 CV 仅允许作为内部实现。儿童报告不得出现 `CV`、方差等术语，只显示“每次展开是否一样”“动作节奏是否稳定”等直白名称。

不引入复杂模型、速度积分、三维重建或动作分类神经网络。

### 3.4 指标聚合规则

对于重复动作：

- Posture 和 Execution：先计算每个完整动作的指标，再取中位数作为模板评分值。
- Consistency：至少需要两个完整动作，使用各动作指标的标准差或 CV。
- 只有一个完整动作时，Posture 和 Execution 仍可评分，Consistency 显示 `N/A`。
- Consistency 数据不足时不应自动给 0 分或 100 分，也不进入总分权重。
- 完整动作的数量只用于判断数据是否足够，不保存为儿童可见指标，也不影响动作质量分。

对于单腿站立：

- 找到最长且关键点可用的连续单腿站立片段。
- 片段长度只用于判断数据是否足够，不转成得分，也不向孩子报告保持秒数。
- 在该片段内评价骨盆、躯干、抬脚、支撑膝和身体晃动。
- 视频开始和结束处的准备时间不进入姿态评分。

### 3.5 通用评分公式

五个模板统一使用：

- Posture：40%
- Execution：40%
- Consistency：20%

同一分类有两个指标时，首版各占 50%；只有一个指标时占 100%。

继续复用当前 `range` 评分：

- 实际值在 `[L, U]` 内：100 分。
- 低于 `L`：在 `margin` 范围内线性下降到 0 分。
- 高于 `U`：在 `margin` 范围内线性下降到 0 分。

继续复用当前 `target` 评分：

- 实际值接近 `target` 且在 `tol` 内：90-100 分。
- 超出 `tol` 后，在 `margin` 范围内线性下降到 0 分。

首版总分只使用模板聚合指标。每项指标保存：

- 实际聚合值
- 儿童可读的目标文字
- `good`、`low` 或 `high` 反馈状态
- 对应的做得好或改进建议

对于 `range` 指标，低于范围和高于范围必须使用不同建议。例如俯卧撑底部肘角过大提示“下降不够深”，过小则提示“下降过深，先保持控制”。不得只显示“Needs work”这类笼统文字。

### 3.6 现有五个 Training 模板同步清理

本次开发不能只约束五个新模板。现有模板中依赖保持时长、动作速度或正确帧比例的指标也要一并删除或替换：

| 现有模板 | 删除内容 | 简单替代方案 |
| --- | --- | --- |
| `deep_squat_reps_side` | 删除 `E_rep_rhythm` / `repTempoSec` | Execution 只保留下蹲深度和顶部充分伸展，各占 50% |
| `high_knees_in_place_side` | 删除 `E_cadence` / `cadenceSPM` | Execution 只评价抬膝是否到位；节奏稳定性仍可作为 Consistency，但儿童端不显示 CV |
| `pushup_hold_high_plank` | 删除 `E_good_form_ratio` / `goodFormFrameRatio`，并删除 `targetHoldSec` | 将现有肘角改为 Execution 的“支撑肘角”，评价是否接近 90 度；Posture 保留身体直线，Consistency 保留身体稳定性 |
| `wall_sit_half_hold` | 删除 `E_hold_duration` / `holdDurationSec`，并删除 `targetHoldSec` | 将膝角从 Posture 移到 Execution，直接评价下蹲深度是否到位 |
| `wall_sit_quarter_hold` | 删除 `E_hold_duration` / `holdDurationSec`，并删除 `targetHoldSec` | 将膝角从 Posture 移到 Execution，直接评价下蹲深度是否到位 |

上述删除必须覆盖模板 JSON、聚合结果、曲线说明和报告文案，避免已删除指标继续以 0 分或旧提示出现在界面中。

## 4. 通用几何定义

建议先在 Training 聚合层统一生成以下基础值：

| 名称 | 计算 |
| --- | --- |
| `midShoulder` | 左右肩坐标平均 |
| `midHip` | 左右髋坐标平均 |
| `midAnkle` | 左右脚踝坐标平均 |
| `shoulderWidth` | 左右肩距离 |
| `trunkLength` | `midShoulder` 到 `midHip` 的距离 |
| `leftLegLength` | 左髋到左膝距离 + 左膝到左踝距离 |
| `rightLegLength` | 右髋到右膝距离 + 右膝到右踝距离 |
| `bodyLength` | 可见侧肩到踝距离 |
| `torsoLeanDegFront` | `midShoulder -> midHip` 与垂直方向夹角 |
| `pelvisTiltDegFront` | 左右髋连线与水平方向夹角的绝对值 |

关键点建议使用 `visibility >= 0.6`。关键点短暂丢失时允许跳过该帧，但不允许用坐标 0 代替缺失点。

## 5. 模板总览

| 动作 | 拍摄方向 | 动作形式 | 评分重点 |
| --- | --- | --- | --- |
| 开合跳 | 正面 | 重复动作 | 躯干、膝内扣、手臂高度、脚距、节奏 |
| 同侧弓步蹲 | 侧面，工作腿靠近镜头 | 同一侧连续重复 | 躯干、前膝位置、前后膝角、深度稳定 |
| 俯卧撑 | 侧面 | 重复动作 | 身体直线、底部深度、顶部伸肘 |
| 单腿站立 | 正面 | 从可用单腿站立片段评价动作质量 | 骨盆、躯干、抬脚、支撑膝、身体晃动 |
| 双脚基础跳绳 | 正面 | 双脚同步重复跳 | 躯干、肘部位置、双脚同步、跳高和节奏 |

以下各表中的 `computeKey`、标准差和相对波动是开发字段，不直接展示给孩子。界面只使用易懂的指标名称、实际表现、目标和建议。

## 6. 开合跳模板

### 6.1 模板信息

- 文件：`web/src/config/templates/training/jumping_jack_reps_front.json`
- `templateId`：`jumping_jack_reps_front`
- 拍摄：正面，全身、双手和双脚始终可见
- 动作信号：`stanceRatio = 左右脚踝水平距离 / shoulderWidth`

### 6.2 完整动作识别

对 `stanceRatio` 做现有 EMA 平滑后使用状态机：

1. 收拢状态：`stanceRatio <= 0.85`
2. 展开状态：`stanceRatio >= 1.10`
3. 完整动作：收拢 -> 展开 -> 再次收拢

`1.10` 只是宽松识别阈值，评分目标仍为 `1.40-2.40`。这样脚距不够的动作仍能被识别并指出问题。

### 6.3 指标

| Metric ID | 分类 | computeKey | 简单计算 | 建议参数 | 儿童反馈重点 |
| --- | --- | --- | --- | --- | --- |
| `P_torso_upright` | Posture | `jumpingJackTorsoLeanDeg` | 每个动作内躯干相对垂直方向的角度中位数 | `range 0-10, margin 15` | 好：身体保持直立；改：身体歪向一侧，收紧核心再跳 |
| `P_landing_knee_alignment` | Posture | `jumpingJackLandingKneeOffsetNorm` | 落地帧左右膝到同侧髋踝连线的距离 / 腿长，再取较差一侧 | `range 0-0.06, margin 0.10` | 好：落地时膝盖朝向脚尖；改：膝盖向内或向外偏，落地时对准脚尖 |
| `E_open_width` | Execution | `jumpingJackOpenStanceRatio` | 每个动作最大脚距 / 肩宽 | `range 1.40-2.40, margin 0.50` | 好：双脚展开到位；低：双脚再打开一些；高：步幅收小一点 |
| `E_arm_height` | Execution | `jumpingJackArmHeightRatio` | 在最大脚距帧，较低一侧手腕高出肩线的距离 / 躯干长度 | `range 0.25-1.20, margin 0.30` | 好：双臂抬起到位；改：打开双脚时把双手再抬高 |
| `C_open_width` | Consistency | `jumpingJackOpenWidthVariation` | 比较各可评估动作的最大脚距，计算内部相对波动 | `range 0-0.15, margin 0.20` | 好：每次展开幅度接近；改：有时大有时小，尽量保持同样脚距 |
| `C_cycle_rhythm` | Consistency | `jumpingJackRhythmVariation` | 比较相邻动作峰值间隔的内部相对波动 | `range 0-0.20, margin 0.30` | 好：动作节奏稳定；改：动作忽快忽慢，按均匀节奏完成 |

手臂高度在“脚距最大帧”计算，因此一个指标同时反映手臂是否抬够和基本的手脚同步，不需要额外设计复杂的相位差指标。

## 7. 同一侧连续弓步蹲模板

### 7.1 模板信息

- 文件：`web/src/config/templates/training/lunge_same_side_reps_side.json`
- `templateId`：`lunge_same_side_reps_side`
- 拍摄：标准侧面，工作腿位于靠近镜头的一侧
- 动作信号：工作腿膝角

工作腿可按整段视频中“膝角变化更明显且平均 visibility 更高”的一侧自动确定，确定后整段视频固定使用该侧。

### 7.2 完整动作识别

1. 顶部状态：工作腿膝角 `>= 145 度`
2. 下降状态：工作腿膝角 `<= 130 度`
3. 完整动作：顶部 -> 下降 -> 回到 `>= 145 度`
4. 最低点：该周期内工作腿膝角最小的帧

评分目标比识别阈值更严格。浅弓步仍可进入评分，但会在前后膝角指标中体现。

### 7.3 指标

| Metric ID | 分类 | computeKey | 简单计算 | 建议参数 | 儿童反馈重点 |
| --- | --- | --- | --- | --- | --- |
| `P_bottom_trunk_lean` | Posture | `lungeBottomTrunkLeanDeg` | 最低点肩髋连线相对垂直方向的角度 | `range 0-25, margin 20` | 好：下蹲时上身稳定；改：身体前倾过多，抬起胸口 |
| `P_front_knee_position` | Posture | `lungeFrontKneeOffsetNorm` | 最低点前膝相对前脚踝、沿身体朝向的水平偏移 / 小腿长度 | `range -0.10 to 0.35, margin 0.25` | 好：前膝位置合适；前冲或后缩：调整前后脚距离，让前膝自然对准脚部 |
| `E_front_knee_depth` | Execution | `lungeFrontKneeBottomDeg` | 最低点前腿膝角 | `range 75-110, margin 25` | 好：前腿下蹲到位；浅：再向下蹲一点；过深：稍微减小幅度并保持控制 |
| `E_rear_knee_depth` | Execution | `lungeRearKneeBottomDeg` | 同一最低点后腿膝角 | `range 70-120, margin 30` | 好：后膝跟随身体下降；改：后膝再向地面下降一些 |
| `C_depth_consistency` | Consistency | `lungeBottomKneeStdDeg` | 各完整动作前膝最低点角度标准差 | `range 0-10, margin 15` | 好：每次深度接近；改：每次深浅不同，固定步幅并控制最低点 |
| `C_cycle_rhythm` | Consistency | `lungeRhythmVariation` | 比较相邻最低点间隔的内部相对波动 | `range 0-0.25, margin 0.35` | 好：动作节奏稳定；改：下降和站起忽快忽慢，保持均匀节奏 |

前膝偏移只用于提示平衡和脚步位置，阈值保持宽松，不使用“膝盖绝对不能超过脚尖”的硬性规则。

没有回到顶部时不建立可评估片段。若因此没有可用数据，只提示“每次下蹲后请重新站回起始位置”，不统计未完成次数。

## 8. 俯卧撑模板

### 8.1 模板信息

- 文件：`web/src/config/templates/training/pushup_reps_side.json`
- `templateId`：`pushup_reps_side`
- 拍摄：标准侧面，肩、髋、踝、肘和手腕完整可见
- 动作信号：可见侧肘角

### 8.2 完整动作识别

1. 顶部状态：肘角 `>= 145 度`
2. 底部状态：肘角 `<= 130 度`
3. 完整动作：顶部 -> 底部 -> 回到 `>= 145 度`
4. 最低点：该周期内肘角最小的帧

`130 度` 是宽松识别阈值，底部执行目标仍为 `70-105 度`。

### 8.3 身体线计算

使用侧面可见侧的肩、髋、踝：

1. 建立肩到踝的直线。
2. 计算髋到该直线的垂直距离。
3. 除以肩到踝的身体长度。
4. 评分使用绝对偏移，偏移方向只用于区分“塌腰”和“撅臀”提示。

每个完整动作取动作过程中最大的绝对髋偏移，避免只看底部一帧而漏掉上升阶段的身体变形。

### 8.4 指标

| Metric ID | 分类 | computeKey | 简单计算 | 建议参数 | 儿童反馈重点 |
| --- | --- | --- | --- | --- | --- |
| `P_body_line` | Posture | `pushupHipLineDeviationNorm` | 每个动作中髋到肩踝线的最大绝对偏移 / 身体长度 | `range 0-0.08, margin 0.12` | 好：肩、髋、脚踝保持直线；塌腰：收紧腹部；撅臀：把髋部放低 |
| `E_bottom_depth` | Execution | `pushupBottomElbowDeg` | 每个动作最小肘角 | `range 70-105, margin 30` | 好：下降深度到位；浅：胸口再靠近地面；过深：稍减幅度并保持控制 |
| `E_top_extension` | Execution | `pushupTopElbowDeg` | 动作结束附近的最大肘角 | `range 155-180, margin 25` | 好：顶部手臂伸展到位；改：推起时把手臂再伸直一些 |
| `C_depth_consistency` | Consistency | `pushupBottomElbowStdDeg` | 各完整动作最小肘角标准差 | `range 0-10, margin 15` | 好：每次下降深度接近；改：每次深浅不同，选择能稳定控制的幅度 |
| `C_body_line_consistency` | Consistency | `pushupHipLineDeviationStd` | 各完整动作最大髋偏移的标准差 | `range 0-0.04, margin 0.08` | 好：身体线一直稳定；改：后面逐渐塌腰或撅臀，持续收紧核心 |

俯卧撑首版不加入肘部外展角，因为侧面二维视频无法稳定判断肘部相对躯干的横向位置。

## 9. 单腿站立模板

### 9.1 模板信息

- 文件：`web/src/config/templates/training/single_leg_stand_front.json`
- `templateId`：`single_leg_stand_front`
- 拍摄：正面，全身和双脚可见
- 动作信号：左右脚踝垂直高度差 / 腿长

### 9.2 有效区间识别

1. 抬脚开始：双脚高度差比例 `>= 0.05`，并持续至少约 0.25 秒。
2. 尝试结束：高度差比例 `< 0.03`，并持续至少约 0.30 秒。
3. 视频中有多个可用片段时，选择关键点最完整、连续性最好的片段；质量相同时再选择较长片段。
4. 最短连续帧要求只用于确认数据足够，不转成分数或报告中的秒数。

`0.05` 是识别阈值，抬脚高度评分目标更高，避免脚尖轻微离地却被视为标准动作。

### 9.3 指标

| Metric ID | 分类 | computeKey | 简单计算 | 建议参数 | 儿童反馈重点 |
| --- | --- | --- | --- | --- | --- |
| `P_pelvis_level` | Posture | `singleLegPelvisTiltDeg` | 有效区间内左右髋连线相对水平线的角度中位数 | `range 0-8, margin 12` | 好：骨盆基本水平；改：一侧髋部抬高或下沉，想象腰带保持水平 |
| `P_torso_upright` | Posture | `singleLegTorsoLeanDeg` | 肩中点到髋中点连线相对垂直方向的角度中位数 | `range 0-10, margin 15` | 好：上身保持直立；改：身体向一侧歪，眼睛看前方并收紧核心 |
| `E_foot_clearance` | Execution | `singleLegFootClearanceRatio` | 抬起脚踝高于支撑脚踝的距离 / 抬起侧腿长 | `range 0.08-0.35, margin 0.15` | 好：抬脚高度清楚稳定；低：把脚再抬高一些，避免接近地面；高：不用抬得过高 |
| `E_support_knee_control` | Execution | `singleLegSupportKneeOffsetNorm` | 支撑膝到同侧髋踝连线的距离 / 支撑腿长度 | `range 0-0.06, margin 0.10` | 好：支撑膝对齐髋和脚踝；改：膝盖偏向一侧，让膝盖朝向脚尖 |
| `C_body_sway` | Consistency | `singleLegBodySwayStdNorm` | 有效区间内髋中点 X 坐标标准差 / 肩宽 | `range 0-0.08, margin 0.12` | 好：身体位置稳定；改：左右晃动较大，盯住前方固定点 |
| `C_pelvis_stability` | Consistency | `singleLegPelvisTiltStdDeg` | 有效区间内骨盆倾斜角标准差 | `range 0-5, margin 8` | 好：骨盆保持平稳；改：骨盆上下摆动，收紧支撑侧臀部 |

单腿站立只评价“站立时姿态是否正确、支撑是否稳定”。相同动作质量的视频，无论可用片段较短还是较长，都应得到接近的指标分数；数据太少时显示 `N/A`，不能按保持长度扣分。

## 10. 双脚基础跳绳模板

### 10.1 模板信息

- 文件：`web/src/config/templates/training/jump_rope_basic_front.json`
- `templateId`：`jump_rope_basic_front`
- 拍摄：正面，全身、双脚、双肘和双腕可见
- 动作形式：双脚同时起跳、同时落地
- 动作信号：脚踝中点相对地面基线的高度

首版不识别绳子本身，只分析人体动作。

### 10.2 完整动作识别

1. 使用整段视频脚踝中点 Y 坐标的高分位值估计地面基线。
2. 离地高度比例：`(groundY - midAnkleY) / medianLegLength`。
3. 地面状态：离地高度比例 `<= 0.01`。
4. 腾空状态：离地高度比例 `>= 0.02`。
5. 完整动作：地面 -> 腾空 -> 回到地面。

识别阈值低于跳跃高度评分目标，因此跳得过低仍能被识别并给出反馈。

### 10.3 指标

| Metric ID | 分类 | computeKey | 简单计算 | 建议参数 | 儿童反馈重点 |
| --- | --- | --- | --- | --- | --- |
| `P_torso_upright` | Posture | `jumpRopeTorsoLeanDeg` | 各跳跃周期躯干相对垂直方向的角度中位数 | `range 0-10, margin 15` | 好：上身直立；改：身体左右歪或甩动，缩小动作并收紧核心 |
| `P_elbow_position` | Posture | `jumpRopeElbowDistanceNorm` | 左右肘分别到同侧髋部垂直线的水平距离平均值 / 肩宽 | `range 0-0.45, margin 0.30` | 好：双肘靠近身体；改：双肘张得太开，把手臂收回身体两侧 |
| `E_foot_sync` | Execution | `jumpRopeFootAsymmetryNorm` | 腾空最高点左右脚踝高度差 / 腿长 | `range 0-0.05, margin 0.10` | 好：双脚一起离地；改：双脚高度不同，尝试同时起跳和落地 |
| `E_jump_height` | Execution | `jumpRopeJumpHeightRatio` | 每次跳跃最大离地高度 / 腿长 | `range 0.04-0.18, margin 0.12` | 好：跳跃高度合适；低：稍微跳高一点；高：降低高度，用轻快小跳 |
| `C_jump_height` | Consistency | `jumpRopeJumpHeightVariation` | 比较各可评估跳跃高度，计算内部相对波动 | `range 0-0.20, margin 0.25` | 好：每次跳跃高度接近；改：有时高有时低，保持轻快小跳 |
| `C_cycle_rhythm` | Consistency | `jumpRopeRhythmVariation` | 比较相邻腾空最高点间隔的内部相对波动 | `range 0-0.20, margin 0.30` | 好：跳跃节奏稳定；改：节奏忽快忽慢，保持均匀起跳 |

当前采样约为 12 FPS，因此不使用左右脚起落时间差这类过细时序指标。左右脚在腾空最高点的高度差更容易计算，也更符合现有数据精度。

## 11. 明确不采用的首版指标

为控制实现复杂度和误判风险，首版不采用：

- 任何动作的保持秒数、达标时长或总视频时长得分。
- 视频总动作次数作为 Execution 得分。
- 标准动作次数、未达标动作次数或达标比例。
- 每分钟动作次数或固定速度目标。
- 单次动作耗时作为 Execution 得分。
- 正确姿态帧占比或“Good Form Ratio”。
- 开合跳手脚相位差的毫秒级计算。
- 弓步蹲左右腿对比，因为本模板固定为同一侧连续重复。
- 俯卧撑肘部外展角，因为侧面二维视频不可靠。
- 单腿站立总视频内的正确帧比例，因为准备时间会污染结果。
- 跳绳绳体识别、手腕旋转角度和精确触地时刻。
- 跳绳交替脚、单脚跳或交叉跳。

## 12. 建议的数据输出

Training 聚合结果只向报告提供动作质量所需字段：

| 字段 | 说明 |
| --- | --- |
| `analysisStatus` | `ready` 或 `insufficient_data`，数据不足时不生成分数 |
| `metricActualValue` | 经过中位数或稳定性聚合后的实际表现 |
| `metricTargetText` | 儿童可读目标，例如“底部肘角 70-105 度” |
| `metricFeedbackState` | `good`、`low` 或 `high` |
| `metricFeedbackText` | 与状态对应的具体表扬或改进建议 |
| `consistencyAvailable` | 稳定性数据是否足够；不足时显示 `N/A` |
| `cameraMatch` | 拍摄方向是否与模板建议一致 |

内部可以保留动作片段边界用于调试，但不得把片段数量、保持秒数或达标次数传成儿童评分指标。

儿童报告采用“指标名称 + 实际表现 + 目标 + 建议”，例如：

| 状态 | 报告示例 |
| --- | --- |
| 做得好 | `俯卧撑下降深度：底部肘角约 92 度，目标 70-105 度。做得好，身体下降到位。` |
| 需要改进 | `俯卧撑下降深度：底部肘角约 118 度，目标 70-105 度。下降还不够，下次让胸口更靠近地面。` |
| 做得好 | `开合跳展开幅度：脚距约为肩宽的 1.55 倍，目标 1.40-2.40 倍。双脚展开到位。` |
| 需要改进 | `开合跳展开幅度：脚距约为肩宽的 1.18 倍，目标 1.40-2.40 倍。双脚可以再向两侧打开一些。` |
| 做得好 | `单腿站立支撑膝：膝盖基本对齐髋和脚踝。支撑腿控制得很好。` |
| 需要改进 | `单腿站立支撑膝：膝盖偏离腿部中线较明显。让膝盖朝向脚尖，并保持在髋和脚踝之间。` |

每个指标都要配置 `hint_good`、`hint_low` 和 `hint_high`；单向指标可省略不可能出现的一侧。报告不显示 computeKey、CV、标准差或公式。

## 13. 开发文件与顺序

### 阶段 1：通用时序结构

修改：

- `web/src/lib/trainingTemporal.ts`

新增：

- 基于时间戳的完整周期结构。
- 阈值滞回状态机。
- 按时间而非固定帧数限制最短动作间隔。
- 单腿站立有效区间检测。

### 阶段 2：Training 基础特征

修改：

- `web/src/lib/dribbleTemporal.ts`
- `web/src/components/Pose2D/poseMetrics.ts`
- `web/src/lib/trainingCalculator.ts`

新增双侧关键点特征、正面指标和五个模板聚合函数。删除模板不再使用的时长、速度和正确帧比例输出；若某个 computeKey 仍被其他功能使用，则只移除模板与报告引用。

### 阶段 3：评分器的数据不足处理

修改：

- `web/src/lib/scoring.ts`
- `web/src/components/Pose2D/PoseAnalysisView.tsx`

要求：

- 无完整动作时不生成误导性总分。
- 一次完整动作可评价 Posture 和 Execution。
- 少于两次完整动作时 Consistency 显示 N/A。
- 缺失分类不参与权重前，至少要保证 Posture 和 Execution 各有一个可用指标。

### 阶段 4：模板配置

新增：

- `web/src/config/templates/training/jumping_jack_reps_front.json`
- `web/src/config/templates/training/lunge_same_side_reps_side.json`
- `web/src/config/templates/training/pushup_reps_side.json`
- `web/src/config/templates/training/single_leg_stand_front.json`
- `web/src/config/templates/training/jump_rope_basic_front.json`

修改：

- `web/src/config/templates/index.ts`
- `web/src/config/templates/training/deep_squat_reps_side.json`
- `web/src/config/templates/training/high_knees_in_place_side.json`
- `web/src/config/templates/training/pushup_hold_high_plank.json`
- `web/src/config/templates/training/wall_sit_half_hold.json`
- `web/src/config/templates/training/wall_sit_quarter_hold.json`

五个新模板都使用明确的 `camera`、`categoryWeights`、指标权重、目标范围，以及 `hint_good`、`hint_low`、`hint_high`。同时按 3.6 节清理现有五个模板。

### 阶段 5：模板选择和报告

修改：

- `web/src/app/pose-2d/training/page.tsx`
- `web/src/components/Pose2D/PoseWorkspaceShell.tsx`
- `web/src/components/Pose2D/MetricTimelineCard.tsx`
- `web/src/app/pose-2d/report/page.tsx`

要求：

- 自由训练可选择全部 Training 模板。
- 教练任务进入时锁定任务指定模板。
- 上传前显示正面或侧面拍摄要求。
- 报告显示实际表现、简单目标和具体正反向建议。
- 报告不显示保持时长、动作次数、标准动作次数、问题动作比例或内部统计术语。

### 阶段 6：验证

至少覆盖以下合成或真实样例：

1. 只有一个可评估动作。
2. 同一动作在视频中重复较少或较多，但动作质量相同。
3. 视频从动作中间开始。
4. 视频结尾是半个动作。
5. 动作幅度不足但能越过宽松识别阈值。
6. 关键点短暂丢失。
7. 错误拍摄方向。
8. 不同长度但动作质量相同的单腿站立视频，质量分应接近。
9. 跳绳速度较快但仍在 12 FPS 可识别范围。
10. 同一段标准动作前后增加准备时间，质量得分基本不变。
11. 所有模板报告同时覆盖 `good`、`low`、`high` 和 `N/A` 文案。

运行：

- Training 时序单元测试
- `npm run lint`
- `npm run build`
- `git diff --check`
- 后端本地模板同步 dry-run

## 14. 验收标准

- 五个新模板都能在 Training 模板选择器中出现。
- 每个模板明确显示正确拍摄方向。
- 重复动作至少识别一个完整周期后即可评价 Posture 和 Execution。
- 所有新旧模板均不以保持时长、视频总时长、动作总次数、标准动作次数或达标比例评分。
- `holdDurationSec`、`goodFormFrameRatio`、`cadenceSPM` 和 `repTempoSec` 不再被 Training 模板或报告引用。
- 单腿站立只评价姿态、动作是否到位和稳定性，片段长度不进入分数。
- 动作质量相同时，视频更长或重复更多次不会因此获得更高分。
- 半个动作不会混入完整动作的角度统计。
- 错误动作可以被宽松识别阈值捕获，并在严格评分阈值下显示问题。
- 只有一个完整动作时 Consistency 显示 N/A，不自动给 0 分或 100 分。
- 报告提示包含儿童可读的实际表现、目标、做得好的反馈和具体改进建议。
- 报告不显示动作次数、保持秒数、CV、标准差、computeKey 或公式。
- 现有五个 Training 模板完成 3.6 节的有意调整，其他仍保留的指标不发生回归。

## 15. 开发检查清单

- [ ] 建立只用于内部取样的完整动作和可用片段结构。
- [ ] 增加正面和侧面所需的基础归一化特征。
- [ ] 实现开合跳完整周期和指标聚合。
- [ ] 实现同侧弓步蹲完整周期和指标聚合。
- [ ] 实现俯卧撑完整周期和指标聚合。
- [ ] 实现单腿站立可用片段和无时长得分的指标聚合。
- [ ] 实现双脚基础跳绳周期和指标聚合。
- [ ] 处理一次动作时 Consistency N/A 的评分逻辑。
- [ ] 清理现有五个模板中的时长、速度、次数和正确帧比例指标。
- [ ] 新增并注册五个 JSON 模板。
- [ ] 接通 Training 模板选择和拍摄提示。
- [ ] 增加报告实际值、简单目标及 `good`、`low`、`high` 具体文案。
- [ ] 完成测试、构建和本地模板同步验证。
