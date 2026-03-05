---
name: pageindex-knowledge-source
description: "PageIndex is the ONLY knowledge source. All factual data and information must come from PageIndex documents. No fabrication or invention. Exception: PitchForge strategy can reason freely, but specific recommendations with actual data must still cite the knowledge source and context."
---

# PageIndex 唯一知识源

本工作区内，**PageIndex 是唯一可信知识源**。所有涉及事实、数据、具体信息的回答，**必须**来自 PageIndex 中的文档检索，不得自行编撰、臆测或引用其他未检索到的来源。

---

## 一、核心原则

1. **唯一知识源**：凡需引用的事实、数字、政策、案例、结论等，**仅允许**来自 PageIndex 中已检索到的文档内容。
2. **禁止编撰**：不得编造、推测或使用未在 PageIndex 中查证的信息；不得用「一般常识」「通常来说」等模糊表述替代可溯源的检索结果。
3. **必须溯源**：每条关键事实或结论需标明来自 PageIndex 中的哪一份文档、哪个章节/节点，便于用户核实。

---

## 二、PitchForge 例外（策略可自由，内容须有据）

当任务涉及 **PitchForge**（如销售策略、话术设计、竞品应对思路等）时：

| 部分           | 自由度         | 约束                                                         |
| -------------- | -------------- | ------------------------------------------------------------ |
| **策略思考**   | 可相对自由思考 | 策略方向、框架、逻辑推理可基于常识与业务理解，不必逐条溯源。 |
| **具体建议内容** | **必须严格有据** | 涉及具体数据、案例、政策条文、数字、事实时，**必须**来源于 PageIndex 检索结果及对话上下文中的实际情况。 |

- **示例（允许）**：策略上建议「采用价值导向而非价格导向」——可自由阐述。
- **示例（禁止）**：建议中写出「该园区税费减免约 30%」——若该数字未在 PageIndex 检索结果中出现，则不得编撰；必须查到并注明来源，或明确说明「需在知识库中进一步查证」。

---

## 三、使用 PageIndex 工具

> **重要**：以下工具（`listDocuments`、`getDocumentMetadata`、`retrieveFromDocument` 等）是 **Agent 可直接调用的 Tools**，与 `skill`、`bash` 并列注册在你的工具列表中。**请直接调用这些工具名**（如调用 `listDocuments`、`retrieveFromDocument`），**不要**用 bash 运行它们——它们不是脚本文件，不在 skill 目录下，bash 无法执行它们。

| 目标           | 工具                 | 说明                                         |
| -------------- | -------------------- | -------------------------------------------- |
| 发现文档       | `listDocuments`      | 先列出可用文档，获取 doc_id                  |
| 文档元数据     | `getDocumentMetadata`| 确认文档状态、页数                           |
| 文档结构       | `getDocumentTree`    | 长文档先看结构，再定位章节                   |
| 全文/章节内容  | `getDocumentOcr`     | 按页或按结构提取内容                         |
| 语义检索       | `retrieveFromDocument`| 按问题在文档内检索相关段落                   |
| 直接提问       | `chatWithDocuments`  | 对指定文档提问，获取汇总回答                 |

**流程建议**：直接调用 `listDocuments` → 选定 doc_id → 视情况直接调用 `getDocumentTree` / `retrieveFromDocument` / `chatWithDocuments` 获取内容，再基于检索结果作答。

---

## 四、强制约束与自检

### 4.1 必须遵守

1. **有据可查**：回答中的关键事实、数字、政策、案例必须能在 PageIndex 检索结果中找到对应出处。
2. **明确标注**：引用时注明文档名、章节/节点或页面，格式示例：`[文档名] 第 X 页 / 节点 XXX`。
3. **无据则说明**：若 PageIndex 中未检索到相关内容，须明确告知用户「在 PageIndex 中未检索到相关信息」，不得改用其他来源或编造。

### 4.2 自检清单（给出最终回答前）

- [ ] 回答中的**事实与数据**是否都来自 PageIndex 检索结果？
- [ ] **PitchForge 策略**以外的具体建议，是否均标注了来源或标明「未在知识库中查到」？
- [ ] 是否**未使用**任何未在 PageIndex 中查证的信息作为可信依据？

任一项未通过则修正后再交付。
