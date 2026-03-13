# PageIndex：获取文档原文与按页定位 — 方案研究

## 1. 当前实现简要

- **参考来源**：从 `get_page_content` / `get_content` 的 tool 调用中解析出 `doc_name` 与 `pages`（见 `lib/citations/sources.ts`）。
- **点击参考来源**：通过 `doc-source-drawer` 用 `doc_name` 调 `/api/doc/resolve?name=...` 得到 `docId`，再在抽屉里用 `DocPreview` 请求 `/api/doc/[docId]/content`。
- **内容 API**：`app/(chat)/api/doc/[docId]/content/route.ts` 请求 PageIndex：
  - `GET https://api.pageindex.ai/doc/{docId}/?type=ocr&format=page`
  - 即当前展示的是 **OCR 结果**（按页的 markdown/文本），不是原始 PDF 或“未 OCR 的原文”。

## 2. PageIndex API 文档结论（官方 endpoints）

依据 [PageIndex API Reference](https://docs.pageindex.ai/endpoints)：

### 2.1 文档内容接口

- **唯一的内容获取接口**：`GET https://api.pageindex.ai/doc/{doc_id}/`
- **支持的 `type`**：
  - `type=ocr`：OCR 结果（markdown，可按页/按节点/raw）
  - `type=tree`：文档树结构（含 node 摘要、page_index 等）
- **没有**在文档中看到：
  - `type=original` / `type=pdf` / 任何“下载原文件”的说明
  - 返回原始 PDF 或“未经过 OCR 的原文”的接口描述

### 2.2 OCR 结果与按页

- `type=ocr&format=page` 时，返回的是**按页**结构，每页包含：
  - `page_index`
  - `markdown`（或文档中的 `text`）
  - `images`（base64 等）
- 因此：**按页（page）获取内容、并在前端定位到某一页**，在现有 OCR 接口上即可实现；当前前端的 `DocPreview` + `initialPage` + `#page-{n}` 已支持“定位到具体页”的展示。

### 2.3 原文 / 原文件

- 公开文档中**没有**提供通过 `doc_id` 下载原始 PDF 或“非 OCR 原文”的端点。
- 若业务上必须展示“文档原文”（即原始 PDF 或上传前的原文），可行方向包括：
  1. **向 PageIndex 确认**：是否有未公开的“原文件下载”或“原文”类 API（或计划中）。
  2. **自建存储**：在上传/同步到 PageIndex 时，在自己后端或对象存储保留一份 PDF（或原文），再自建接口（如 `/api/doc/[id]/original` 或 `/api/doc/[id]/pdf`）做下载/预览；前端“参考来源”可链到该自建接口。

## 3. MCP 与 get_page_content

- `get_page_content` 来自 **PageIndex MCP**（`https://api.pageindex.ai/mcp`），不是本项目自定义 tool。
- 当前逻辑是：从该 tool 的 **input/output** 里解析出 `doc_name` 和 `pages`，再在前端用 `doc_name` → resolve → `docId` → 调我们自己的 `/api/doc/[docId]/content`（背后仍是 PageIndex 的 `type=ocr&format=page`）。
- 因此：
  - **是否返回“原文”**：取决于 PageIndex MCP/API 是否暴露“原文”或“原文件”能力；从公开 API 文档看，目前只有 OCR/tree，没有原文/PDF 下载。
  - **是否支持按 page 展示**：支持。我们已有 `docId`、`initialPage`，且 OCR 返回按页数据；`DocPreview` 已实现按 `page_index` 展示并滚动到指定页。

## 4. 总结表

| 需求 | 结论 |
|------|------|
| 获取**文档原文**（非 OCR） | 官方 API 文档中**无**对应端点；需向 PageIndex 确认或自建“原文件/原文”存储与接口。 |
| **按 page 定位并展示** | **已支持**：OCR 返回按页结构，前端用 `initialPage` + `#page-{n}` 即可定位到具体页。 |
| **pageIndex 的 MCP/API** | MCP 的 `get_page_content` 与 `GET doc/{doc_id}/?type=ocr&format=page` 一致，均为 OCR 结果；未见“原文”或“原文件”的 MCP 扩展说明。 |

## 5. 建议（仅方案，不涉及实现）

1. **若必须展示“原文”**：  
   - 短期：与 PageIndex 确认是否有“原文件/原文” API 或 MCP 扩展。  
   - 中长期：考虑在上传/同步阶段自存 PDF，并自建下载/预览接口，与现有“参考来源”链接打通。

2. **若仅需“定位到具体页”**：  
   - 保持现有 OCR + `DocPreview` + `initialPage` 即可；无需为“原文”单独接 PageIndex 新接口。

3. **参考来源位置**：  
   - 已按需求调整为：在 CoT/tools 之下、大模型最终回答之上（见本次对 `components/message.tsx` 的修改）。
