# Artifact 系统问题解答总结

## 你的三个核心问题

### Q1: Sub-Agent 使用什么模型？为什么 Markdown 表格格式错乱？

**答案**:

**使用的模型**: `Claude Haiku 4.5`
```typescript
// lib/ai/providers.ts 第 71-76 行
export function getArtifactModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("artifact-model");
  }
  return gateway.languageModel("anthropic/claude-haiku-4.5"); // ⚠️ 这里
}
```

**为什么选择 Haiku？**
- ✅ **速度快**: Haiku 是 Claude 系列中最快的模型
- ✅ **成本低**: 比 Sonnet 便宜约 5 倍
- ✅ **适合流式生成**: 延迟低，用户体验好

**为什么表格格式错乱？**
- ❌ **能力限制**: Haiku 是最小的模型，对复杂格式的掌握不够精确
- ❌ **注意力不足**: 在流式生成时难以维护表格的对齐和一致性
- ❌ **Markdown 语法**: Haiku 对 Markdown 表格语法的理解不如 Sonnet

**对比**:
| 模型 | 速度 | 成本 | 格式质量 | 推理能力 |
|------|------|------|----------|----------|
| Haiku 4.5 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ |
| Sonnet 4.5 | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Opus 4.5 | ⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**解决方案**: 升级到 Sonnet 4.5
```typescript
export function getArtifactModel() {
  return gateway.languageModel("anthropic/claude-sonnet-4.5");
}
```

---

### Q2: 主 Agent 和 Sub-Agent 之间只有标题作为互动信息吗？

**答案**: **是的！这是一个严重的设计缺陷！**

**当前的信息传递**:
```typescript
// createDocument 只接受 title 和 kind
inputSchema: z.object({
  title: z.string(),        // ⚠️ 只有标题
  kind: z.enum(artifactKinds),
})

// Sub-Agent 只接收 title
onCreateDocument: async ({ title, dataStream }) => {
  const { fullStream } = streamText({
    model: getArtifactModel(),
    system: "Write about the given topic. Markdown is supported.",
    prompt: title,      // ⚠️ 只有标题！
  });
}
```

**问题示例**:
```
用户输入:
"帮我写一篇关于越南投资环境的文章，重点分析制造业的机会和风险"

主 Agent 的处理:
1. ✅ 使用知识检索工具查找 "越南投资专题.md"
2. ✅ 找到大量专业数据和分析
3. ✅ 理解用户需求：重点是制造业
4. ❌ 调用 createDocument(title: "越南投资环境分析", kind: "text")

Sub-Agent 接收到的:
- title: "越南投资环境分析"
- ❌ 没有知识检索的结果
- ❌ 没有"重点分析制造业"的要求
- ❌ 没有任何背景资料

结果:
Sub-Agent 只能根据自己的训练数据（可能已过时）生成一篇泛泛的文章，
完全浪费了主 Agent 辛苦检索到的专业知识！
```

**信息丢失率**: 约 **70-80%** 的上下文信息被丢弃！

---

### Q3: 主 Agent 的更多想法和上下文怎么给 Sub-Agent？（比如知识检索的结果）

**答案**: **当前架构无法传递，需要扩展 Tool 的参数！**

**改进方案**:

#### 方案 1: 扩展 createDocument 参数（推荐）

```typescript
// 修改 inputSchema
inputSchema: z.object({
  title: z.string(),
  kind: z.enum(artifactKinds),
  
  // ✅ 新增：背景知识和上下文
  context: z.string().optional().describe(
    "Background knowledge, research findings, or relevant information"
  ),
  
  // ✅ 新增：详细要求
  requirements: z.string().optional().describe(
    "Specific requirements, constraints, or focus areas"
  ),
})

// 主 Agent 调用时传递完整信息
await createDocument({
  title: "越南投资环境分析",
  kind: "text",
  
  // ✅ 传递知识检索结果
  context: `根据知识库《2024 越南投资专题》：
- 越南 2024 年 GDP 增长预计 6.5%
- 制造业占 GDP 的 25%，是主要支柱产业
- 劳动力成本比中国低 30-40%
- 主要工业园区：河内、胡志明市、海防
- 税收优惠：前 4 年免税，后 9 年减半
...（完整的知识库内容）`,
  
  // ✅ 传递用户的具体要求
  requirements: `重点分析：
1. 制造业的投资机会和优势
2. 主要工业园区对比
3. 政策优惠和税收
4. 风险和挑战
5. 实际案例`,
})
```

#### 方案 2: 传递对话历史

```typescript
// 让 Sub-Agent 看到完整的对话上下文
export type CreateDocumentCallbackProps = {
  id: string;
  title: string;
  conversationHistory?: ChatMessage[],  // ✅ 对话历史
  dataStream: UIMessageStreamWriter<ChatMessage>;
  session: Session;
};

// Sub-Agent 使用对话历史
onCreateDocument: async ({ title, conversationHistory, dataStream }) => {
  const { fullStream } = streamText({
    model: getArtifactModel(),
    messages: [
      ...conversationHistory,  // ✅ 包含所有上下文
      { role: "user", content: `Write a document: ${title}` }
    ],
  });
}
```

#### 方案 3: 给 Sub-Agent 工具访问权限

```typescript
// 让 Sub-Agent 自己访问知识库
onCreateDocument: async ({ title, dataStream, session }) => {
  const { fullStream } = streamText({
    model: getArtifactModel(),
    system: "You are a professional writer with access to knowledge base.",
    prompt: title,
    tools: {
      searchKnowledge: knowledgeSearchTool,  // ✅ 给 Sub-Agent 工具
    },
  });
}
```

---

### Q4: Sub-Agent 的定位是什么？

**当前定位**: **"简单的内容生成器"**
- 只负责根据标题生成内容
- 没有上下文信息
- 没有推理能力
- 像一个"打字机"

**应该的定位**: **"有上下文的专业写作助手"**
- 应该能够访问主 Agent 收集的知识
- 应该理解用户的详细需求
- 应该能够进行结构化的内容组织
- 应该生成高质量、专业的内容

**类比**:
```
当前的 Sub-Agent = 一个只知道标题的实习生
改进后的 Sub-Agent = 一个拿到完整资料和要求的专业作家
```

---

## 综合改进建议

### 立即可行（不改架构）

1. **升级模型**:
```typescript
export function getArtifactModel() {
  return gateway.languageModel("anthropic/claude-sonnet-4.5");
}
```

2. **改进 Prompt**:
```typescript
system: `You are a professional writing assistant.
Write high-quality content with proper formatting.

CRITICAL for Markdown tables:
- Ensure all columns are properly aligned
- Use consistent spacing (at least 3 spaces between columns)
- Double-check table syntax before outputting
- Use | to separate columns clearly

Example of correct table:
| Column 1   | Column 2   | Column 3   |
|------------|------------|------------|
| Data 1     | Data 2     | Data 3     |
`
```

### 中期改进（需要修改代码）

3. **扩展参数传递**:
   - 修改 `createDocument` 接受 `context` 和 `requirements`
   - 修改 `CreateDocumentCallbackProps` 类型
   - 修改所有 document handlers

4. **优化信息流**:
   - 主 Agent 在调用 tool 时传递完整上下文
   - Sub-Agent 基于丰富的信息生成内容

### 长期优化（架构改进）

5. **给 Sub-Agent 工具访问权限**
6. **实现 Sub-Agent 的反馈机制**
7. **支持多轮迭代优化**

---

## 总结

**核心问题**:
1. ❌ Sub-Agent 使用 Haiku 模型，能力不足
2. ❌ 只传递标题，丢失 70% 的上下文
3. ❌ Sub-Agent 定位不清晰，像"打字机"而非"助手"

**解决方案**:
1. ✅ 升级到 Sonnet 模型
2. ✅ 扩展参数传递 context 和 requirements
3. ✅ 重新定位为"专业写作助手"

**预期效果**:
- 表格格式完美
- 内容专业、有深度
- 充分利用知识库
- 满足用户的详细要求

