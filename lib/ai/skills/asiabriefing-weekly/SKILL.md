---
name: asiabriefing-weekly
description: Retrieves recent Asia Briefing posts (all regions/sub-sites, any topic) from the last 5 days, summarizes them into a list with links and key points, and adds sales-oriented insights. Output is displayed as an Artifact document. Use when the user asks for "Asia Briefing 本周新文", "weekly new posts", "最近几天 Asia Briefing 汇总", or "weekly_new 更新".
---

# Asia Briefing 本周新文汇总

从 Asia Briefing 及子站检索**最近 5 天（或本周）**的新文章，汇总成清单并通过 **Artifact 文档**展示，并延伸销售向洞察。

**信息源约定**：仅使用 Asia Briefing 及子站（见 trusted-sources 3.3）。检索时须将范围限制在下列域名内，不得使用其他外网。

---

## 一、执行流程

### 1. 检索最近新文

- **工具**：使用 Tavily 搜索，**必须**将 `include_domains` 设为 Asia Briefing 域名（见下方域名列表），`time_range` 设为 `"week"`（最近 5 天无单独选项时用本周近似）。
- **范围**：任意地区（中国/印度/越南/东盟/中东等）、任意主题（税务、法律、劳工、贸易、营商环境等）。
- **方式**：可对主站与各子站分别发起搜索（如 "latest news"、"recent updates"），或使用覆盖多站点的查询；合并去重后得到「本周新 post」列表。

### 2. 获取每篇要点

- 对列表中的每篇文章 URL 使用 `mcp_web_fetch` 抓取正文（或使用 Tavily extract）。
- 提炼：标题、发布日期（若有）、3～5 条要点或一段简短总结（2～4 句）。

### 3. 撰写销售延伸洞察

针对本周文章整体或单篇，给出可操作的销售向建议，例如：

- **关注方向**：某国/某行业/某类政策（如关税、用工、自贸区）值得重点跟进；
- **客户类型**：哪些行业或规模的客户可能因此产生需求；
- **潜在商机**：具体可推销的服务或话题（如设立实体、合规审查、薪酬外包）；
- **话术/场景**：可与客户沟通的角度或会议场景。

洞察可广泛、可具体，不必每篇都写，但整份汇总至少包含 3～5 条整体性销售建议。

### 4. 创建 Artifact 文档

**必须使用 `createDocument` 工具**来展示结果：

- **工具调用**：`createDocument({ title: "Asia Briefing 本周新文汇总 (YYYY-MM-DD)", kind: "text" })`
- **kind 参数**：必须设为 `"text"`（Markdown 格式文档）
- **title 格式**：`Asia Briefing 本周新文汇总 (YYYY-MM-DD)`，其中日期为执行日期
- **内容格式**：见下方「输出文档结构」，使用 Markdown 格式
- **禁止**：不得使用 `writeFile` 或其他文件系统工具写入文件

---

## 二、Asia Briefing 域名（检索时 include_domains）

```
www.asiabriefing.com
www.china-briefing.com
www.india-briefing.com
www.vietnam-briefing.com
www.aseanbriefing.com
www.middleeastbriefing.com
```

---

## 三、输出文档结构（必须包含）

```markdown
# Asia Briefing 本周新文汇总（YYYY-MM-DD）

**检索范围**：最近一周；来源仅 Asia Briefing 及子站。

## 文章列表

（每条包含：）

### [文章标题](原始链接)

- **来源**：XX Briefing（若可识别子站）
- **日期**：（若有）
- **要点与总结**：（3～5 条或 2～4 句）
- **销售延伸**：（可选）关注方向 / 客户类型 / 潜在商机 / 话术建议等

（重复以上块，直至本周检索到的文章全部列出。）

## 本周销售洞察汇总

- 方向/客户/商机/话术等 3～5 条整体建议（可引用上文某几篇）。
```

---

## 四、引用与自检

- 每条文章必须带**原始链接**；要点与总结须基于实际抓取内容，不得捏造。
- 区分「来自 Asia Briefing（日期/URL）」与你的推断；销售延伸明确标注为「基于本周文章的销售建议」。
- 若某日检索结果为空，仍写出文档，说明「本周在限定域名内未检索到符合时间范围的新文」，并建议可稍后重试或放宽为「近两周」。

---

## 五、与其它 Skill 的配合

- **trusted-sources**：本技能仅从 Asia Briefing 及子站获取信息，符合 trusted-sources 对外部源的规定；引用格式见 trusted-sources 的 reference-asiabriefing。
- **Artifacts**：使用 `createDocument` 工具创建文档，用户可在界面右侧看到格式化的 Markdown 内容，并可下载、编辑或分享。
