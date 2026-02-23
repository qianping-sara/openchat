---
name: trusted-sources
description: Single entry for all knowledge and information retrieval in this workspace. Defines three trusted sources—local Knowledge folder, Neo4j graph, and Asia Briefing (and sub-sites)—how to use them alone or combined, and mandatory attribution and self-check rules. Use whenever the user needs any internal or external information lookup, fact-checking, or research from these sources.
---

# 可信知识源检索（Trusted Sources）

本工作区内，**任何知识查询或需要内外部信息获取时**，均通过本 Skill 从以下三个可信知识源检索，并遵守统一的溯源与自检规范。

---

## 一、三个可信知识源（均持续更新）

| 来源 | 说明 | 用途概要 |
|------|------|----------|
| **本地 Knowledge** | 工作区根目录下 `Knowledge/` 文件夹；内部文档、案例、区域/行业研究、产品说明、会议纪要等。 | 内部表述、历史做法、可复用结构与话术。 |
| **Neo4j 图** | 图数据库中的实体与关系（如 Region、IndustrialZone、Dimension、ServiceOffering、ServiceProvider、Credential 等）；schema 与数据会持续演进。 | 区域/园区、服务与维度、供应商与资质、需求–供给匹配等结构化查询。 |
| **外部：Asia Briefing** | Asia Briefing 及子站（asiabriefing.com、china-briefing.com、vietnam-briefing.com、india-briefing.com、aseanbriefing.com、middleeastbriefing.com）。 | 亚洲各国税务、法律、劳工、贸易、营商环境与政策更新等可署名引用。 |

**禁止**：**Output/** 为只写目录（存放交付物与留痕），**不得**从 Output 读取或引用为信息来源；输入与溯源仅用上表三源。

**重要**：三者都在持续更新（新文档、新数据、新文章）。检索时**不要用「目前只有……」限制未来可能性**，按当前能访问到的内容作答，并注明时间或版本上的不确定性（若相关）。

---

## 二、按信息性质选源与组合（鼓励综合运用）

三个知识源在内容上**有重叠**：同一国家/区域可能在 Knowledge 有内部研究、在图有园区与服务数据、在 Asia Briefing 有政策及园区相关文章。因此**不按「问什么就用哪个源」简单划分**，而是按**信息需求的性质**决定优先顺序与是否多源并用。

### 2.1 按性质选源

| 性质 | 特征 | 优先级与策略 |
|------|------|----------------|
| **时效性强** | 政策变化、市场动态、行业趋势、最新数据、法规/税政更新 | **优先外部最新** 如（Asia Briefing）→ 再以 Knowledge/图补充内部视角或历史基线。 |
| **确定性高** | 服务能力、供应商资质、成功案例、能力边界、我们能做什么/谁来做 | **优先内部数据** 如（Neo4j 图 + Knowledge）→ 按需用 Asia Briefing 补充外部口径或合规依据。 |
| **综合类** | 需要完整建议、多维度分析、方案/提案、选址或需求匹配 | **同时调用多个源**：如图（能力与区域）+ Knowledge（案例与话术）+ Asia Briefing（政策/法规引用），交叉验证、补全视角。 |

同一问题常**同时涉及多种性质**（例如既要「我们能不能做」又要「当地最新税政」）：按各维度分别套用上表，再组合检索，而不是只选一个源。

### 2.2 默认倾向综合运用

- **多源并用为常态**：除非需求非常窄且单源明显足够（如「只查图里某区域有哪些服务」），否则优先考虑多源——图 + Knowledge 定能力与内部表述，Asia Briefing 定时效与外部依据，或反过来按「时效优先 / 确定性优先」打头阵。
- **单源仅在对性质非常明确且单源足够时采用**；有疑虑时，多查一个源并注明「另据…补充」即可提升可信度与完整性。

---

## 三、分源使用规范

### 3.1 本地 Knowledge

- **找文件**：`Glob`（如 `Knowledge/**/*`）按路径/文件名/修改时间推理；或用 `Grep` 在 `Knowledge/` 下按关键词找真正包含该词的文件。可先列表再 grep 组合。
- **锁定章节**：对候选文件用 `Read`，先看结构（目录、标题），再用 offset/limit 精读相关小节。
- **输出**：关键结论必须标注来源，例如「《文档名》（Knowledge/…/xxx.md）第 X 节 / 章节名」。
- 更多发现流程与引用约定见 [reference-knowledge.md](reference-knowledge.md)。

### 3.2 Neo4j 图知识

- **必先** 调用 `get-schema` 获取当前节点标签、关系类型与属性；**不写死** Cypher，按当前 schema 编写查询。
- **仅读**：只使用 `read-cypher`，不执行任何写操作。需要图算法时先 `list-gds-procedures`。
- **查询锚点**：若用户意图清晰但缺少范围/主体/维度等绑定信息，先按需追问（如哪个区域、哪类服务、按什么维度对比），再查。
- **面向用户的输出**：只用业务语言（如「区域与园区」「服务与案例」「选址维度」），**禁止**在用户可见内容中出现节点/关系名、Cypher、技术实现细节。
- 工具流程与查询锚点说明见 [reference-neo4j.md](reference-neo4j.md)（当前 schema 始终以运行时 get-schema 为准）。

### 3.3 外部：Asia Briefing（唯一允许的外部信息源）

- **约定**：本工作区内，凡需从**外部网络**获取并引用的信息，**仅允许**来自 Asia Briefing 及上述子站。不得使用其它外网、通用网页搜索或未标注来源的「来自网络」「公开资料」作为可信依据。
- **访问方式**：使用 `mcp_web_fetch` 抓取具体 URL；或若使用 Tavily 等搜索，须将 `include_domains` 限制为上述 Asia Briefing 域名。
- **入口**：主站 https://www.asiabriefing.com/ ；按区域 /china、/india、/vietnam、/asean、/middle-east；按主题如 tariff-updates、trade-relations。具体文章多在子站（如 china-briefing.com/news/…）。完整 URL 与引用格式见 [reference-asiabriefing.md](reference-asiabriefing.md)。
- **深度调研**：从合适入口页抓取，根据链接进入子站文章，抓取全文后归纳；结论须注明文章标题、日期（若有）、URL。
- **输出**：区分「来自 Asia Briefing（日期/URL）」与自己的推断；引用格式示例：「[文章标题](URL)，Asia Briefing / XX Briefing，日期」。

### 3.4 各源输出规范（面向用户的交付）

交付给销售、客户或业务侧的内容必须**按源遵守**下列规范，不得暴露技术实现或模糊来源：

| 来源 | 必须 | 禁止 |
|------|------|------|
| **Knowledge** | 关键结论标注**文档路径 + 章节**（如《文档名》（Knowledge/…/xxx.md）第 X 节）；可先用业务化概括（如「根据内部某区域研究」）再附具体路径。 | 未读过的文档不得列为来源；不得只写「内部资料」而无路径与章节。 |
| **Neo4j 图** | 仅用**业务语言**：区域与园区、服务与案例、选址维度、可落地的方案与资质、客户已表达的需求与偏好等；推理用业务思路表述（如「根据您关注的维度和区域，我们匹配了以下服务与案例」）。 | **禁止**在用户可见内容中出现节点类型、关系名、属性名（如 Region、ServiceOffering、PROVIDES_FACT、ADDRESSES）、技术动作（如「查 Cypher」「绑定锚点」）、实现术语（如「查询锚点」「FACT 支撑」）。 |
| **Asia Briefing** | 每条引用注明**文章标题 + 日期（若有）+ URL**；明确区分「来自 Asia Briefing（日期/URL）」与自己的推断。 | 禁止用「来自网络」「公开资料」等模糊表述；未实际抓取并阅读的页面不得列为来源。 |

---

## 四、追问与补全（灵活、必要、有上限）

当检索前**缺少关键信息**（如查图缺区域/维度、查 Asia Briefing 缺国家/主题、查 Knowledge 缺主题范围）时，可向用户做**一轮简短追问**再执行检索。追问须**灵活、只问必要、不纠缠细枝末节**。

- **仅对未覆盖或模糊的锚点追问**：先判断当前输入里哪些已明确、哪些缺失；只对缺失且**不补就无法合理检索**的项发问。优先顺序建议：范围（区域/国家）→ 主体（服务/需求类型）→ 维度（税负、合规、成本等）；同一类型可合并成一句（如「您指的是哪个区域或国家下的园区？」）。
- **话术由锚点类型 + 当前语境生成**，不写死每句问法；追问中可带出已掌握信息以减少重复（如「您提到越南，是想对比越南境内哪几个园区？」）。
- **一轮问答中追问总数不超过 4 个问题**；达到「能执行有意义检索」即止，不必穷尽所有可选细节。避免在细枝末节上反复追问。
- **原则**：追问以「能写出有意义、可执行的查询或检索」为度；一旦信息足够，即执行检索并返回结果。

---

## 五、强制约束与可溯源自检

### 5.1 可信与溯源（必须遵守）

1. **每条关键事实或结论必须有明确来源**：标明来自哪一个知识源（Knowledge / Neo4j / Asia Briefing），以及在该源内的具体位置（文件路径+章节、图查询所对应的业务含义、文章标题+URL）。
2. **外部仅 Asia Briefing**：不得为佐证「最新政策」「行业报道」「某国新闻」等而引用非 Asia Briefing 的外网；若 Asia Briefing 无相关内容，应明确说明「Asia Briefing 未检索到相关内容」，而非改用其它外网。
3. **不捏造来源**：未检索过的文档/节点/页面不得被列为来源；若仅基于模型先验作答，须说明「未在三个可信源中查到，以下为一般性说明」。
4. **时间与边界**：若信息有时效性或 schema/文档已变更的可能，在回答中简要说明（如「截至检索时」「以当前图 schema 为准」），不宣称「永远仅此而已」。

### 5.2 自检清单（在给出最终回答前执行）

- [ ] 回答中的**关键事实与数字**是否都标注了来源（Knowledge 路径+章节 / 图的业务含义 / Asia Briefing 文章+URL）？
- [ ] 是否**未使用**除 Asia Briefing 及其子站以外的外网作为引用来源？
- [ ] 若某条信息**未**从三个源中查到，是否已明确说明「未在可信源中检索到」或区分「一般性说明」？
- [ ] 使用图时是否已**先 get-schema**，且对用户只呈现**业务语言**、未暴露图结构？

任一项未通过则修正后再交付。

---

## 六、与其它 Skill 的配合

- **ascentium-sales-enablement**：销售赋能场景下需要「图 + Knowledge + 外部权威」时，统一按本 Skill 选取来源与引用方式；该 Skill 的 Plan/Todo 中只需写明「从 Knowledge 检索…」「从图查…」「从 Asia Briefing 检索…」，具体操作遵循本 Skill。
- **deep-researcher**：当需要**多源验证、证据链与置信度**的深度研究时，可委托 deep-researcher；在委托中可明确「仅使用本工作区三个可信源（Knowledge、Neo4j、Asia Briefing）作为信息来源」，避免与本研究规范冲突。
- **search**：本工作区内，**对外部可信信息的检索**仅通过 Asia Briefing（见 3.3）；若使用搜索类工具，须将范围限制在 Asia Briefing 域名内，不得用泛化网页搜索替代本 Skill 约定的外部源。

---

## 七、工具与引用速查

| 目标 | 工具/方式 | 溯源要求 |
|------|-----------|----------|
| Knowledge 文件列表 | `Glob`，如 `knowledge/**/*` | 回答中注明文档路径与章节 |
| Knowledge 内容关键词 | `Grep` 于 `knowledge/` | 注明文档路径与章节 |
| 图 schema | `get-schema` | 不向用户暴露 schema |
| 图只读查询 | `read-cypher`（先 schema） | 用业务语言概括，并说明「根据当前服务与区域数据」等 |
| Asia Briefing 页面 | `mcp_web_fetch`或`search` skill（仅 AB 及子站） | 注明文章标题、日期、URL |


