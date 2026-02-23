# Neo4j 图 — 使用细节（3.2 用）

**当前 schema 不在此写死**，每次查询前必须通过 **get-schema** 获取节点标签、关系类型与属性，再编写只读 Cypher。

## 工具与顺序

| 步骤 | 工具 | 说明 |
|------|------|------|
| 1 | `get-schema` | 获取当前图的节点类型、关系类型、属性；据此写 Cypher。 |
| 2 | `read-cypher` | 仅执行只读查询（MATCH/RETURN/WHERE，可带 params）；禁止写操作。 |
| 3 | `list-gds-procedures` | 仅当需要图算法（中心性、社区、路径等）时调用，再按返回说明使用。 |

## 查询锚点（补全后再查）

执行一次有意义查询所需的**绑定信息**，若用户未给全则先追问再查：

| 锚点类型 | 典型缺失时追问 |
|----------|----------------|
| **范围** | 哪个国家/区域？哪些园区（名称或范围）？ |
| **主体** | 针对哪类服务/哪家供应商？ |
| **维度** | 按什么维度对比/筛选（如税负、合规、用工、成本）？ |
| **约束** | 目标区域、必须满足的维度条件？ |

同一类型可合并追问；一旦锚点足够即查，不必穷尽所有可选锚点。

## 业务原子能力列表（按需组合，均以 get-schema 后编写只读 Cypher 实现）

以下能力与**当前图 schema 一致**（节点：Region、IndustrialZone、Dimension、ServiceOffering、ServiceProvider、Credential、Requirement、Stakeholder；关系以 get-schema 为准）。若 schema 后续变更，能力描述需同步调整。

- **区域/园区**：Region、IndustrialZone（PART_OF→Region；DIMENSION_WEIGHT、PROVIDES_FACT→Dimension）做区域/园区对比、筛选、查询。
- **维度→供给**：Dimension ←ADDRESSES— ServiceOffering、ServiceOffering —AVAILABLE_IN→ Region，用于需求匹配或方案推荐。
- **供给→证明**：ServiceOffering —DELIVERED_BY→ ServiceProvider —HAS_CREDENTIAL→ Credential；Credential —ZONE_INVOLVED→ IndustrialZone、—PROVES_SUCCESS_IN→ Dimension，用于客户沟通时的证明/说服。
- **Cross-sell**：某 Dimension 下 ADDRESSES 的多个 ServiceOffering，识别可交叉销售机会。
- **供给→供应**：ServiceOffering —DELIVERED_BY→ ServiceProvider，用于交付与资源安排。
- **维度→选址/落地**：Dimension ←PROVIDES_FACT— Region / IndustrialZone（关系属性 value），支持选址或落地能力判断。
- **选址/约束筛选**：在已知维度及约束下，用 Region/IndustrialZone 的 PROVIDES_FACT（及 value）筛选满足条件的区域/园区。
- **供应商能力**：ServiceProvider ←DELIVERED_BY— ServiceOffering、—HAS_CREDENTIAL→ Credential，用于评估供应商能力与资质。
- **需求→供给**：Requirement —CONCERNS→ Dimension，再沿 Dimension ←ADDRESSES— ServiceOffering 得到可满足该需求的供给；用于从客户需求反推可推荐服务。
- **干系人→需求**：Stakeholder ←RAISED_BY— Requirement —CONCERNS→ Dimension，用于梳理谁提出了哪些需求/维度。

若 schema 后续再扩展（如 Lead、DemandConstraint 等），可据此思路增加对应能力。

面向用户时只输出**业务语言**（区域、园区、服务、案例、维度、需求、干系人），不暴露节点/关系名或 Cypher。
