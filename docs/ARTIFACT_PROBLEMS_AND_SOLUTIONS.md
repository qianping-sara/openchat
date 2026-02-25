# Artifact 系统的问题与改进方案

## 你发现的核心问题

### 问题 1: Sub-Agent 使用的模型

**当前实现**:
```typescript
// lib/ai/providers.ts
export function getArtifactModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("artifact-model");
  }
  return gateway.languageModel("anthropic/claude-haiku-4.5"); // ⚠️ 固定使用 Haiku
}
```

**问题分析**:
- ✅ **优点**: Claude Haiku 4.5 速度快、成本低
- ❌ **缺点**: Haiku 是最小的模型，能力有限
  - 生成的 Markdown 表格格式容易错乱
  - 对复杂内容的理解和生成能力较弱
  - 无法处理需要深度推理的任务

**为什么会格式错乱？**
1. Haiku 模型对 Markdown 语法的掌握不够精确
2. 流式生成时容易出现格式不一致
3. 没有足够的"注意力"来维护表格的对齐

### 问题 2: 主 Agent 和 Sub-Agent 之间的信息传递

**当前实现**:
```typescript
// createDocument 只传递 title
export const createDocument = ({ session, dataStream }: CreateDocumentProps) =>
  tool({
    inputSchema: z.object({
      title: z.string(),        // ⚠️ 只有标题
      kind: z.enum(artifactKinds),
    }),
    execute: async ({ title, kind }) => {
      await documentHandler.onCreateDocument({
        id,
        title,              // ⚠️ 只传递标题
        dataStream,
        session,
      });
    },
  });

// Sub-Agent 只接收 title
onCreateDocument: async ({ title, dataStream }) => {
  const { fullStream } = streamText({
    model: getArtifactModel(),
    system: "Write about the given topic. Markdown is supported.",
    prompt: title,      // ⚠️ 只有标题作为 prompt
  });
}
```

**问题分析**:
- ❌ **主 Agent 的上下文丢失**: 
  - 主 Agent 可能已经通过知识检索获取了大量相关资料
  - 主 Agent 可能已经理解了用户的详细需求
  - 这些信息都没有传递给 Sub-Agent

- ❌ **Sub-Agent 信息不足**:
  - 只有一个简短的标题
  - 没有背景知识
  - 没有用户的详细要求
  - 没有主 Agent 的思考过程

**举例说明问题**:
```
用户: "帮我写一篇关于越南投资环境的文章，重点分析制造业的机会"

主 Agent 的处理:
1. 使用知识检索工具查找 "越南投资专题.md"
2. 找到制造业相关数据
3. 理解用户需求：重点是制造业
4. 调用 createDocument(title: "越南投资环境分析", kind: "text")

Sub-Agent 接收到的:
- title: "越南投资环境分析"  ⚠️ 仅此而已！
- 没有知识检索的结果
- 没有"重点分析制造业"的要求
- 没有任何背景资料

结果:
Sub-Agent 只能根据自己的训练数据生成一篇泛泛的文章，
无法利用主 Agent 已经检索到的专业知识。
```

### 问题 3: Sub-Agent 的定位不清晰

**当前定位**: "内容生成器"
- 只负责根据标题生成内容
- 没有访问知识库的能力
- 没有推理能力
- 像一个"打字机"而不是"智能助手"

**应该的定位**: "专业写作助手"
- 应该能够访问相关知识
- 应该理解用户的详细需求
- 应该能够进行一定的推理和组织
- 应该能够生成高质量、结构化的内容

## 改进方案

### 方案 1: 升级 Sub-Agent 模型

**选项 A: 使用更强的模型**
```typescript
export function getArtifactModel() {
  // 使用 Sonnet 而不是 Haiku
  return gateway.languageModel("anthropic/claude-sonnet-4.5");
}
```

**优点**:
- ✅ 更好的格式控制（表格不会错乱）
- ✅ 更强的理解和生成能力
- ✅ 更好的 Markdown 语法掌握

**缺点**:
- ❌ 成本增加（Sonnet 比 Haiku 贵约 5 倍）
- ❌ 速度稍慢

**选项 B: 根据任务类型选择模型**
```typescript
export function getArtifactModel(kind?: ArtifactKind) {
  if (kind === "code") {
    // 代码生成可以用 Haiku（格式简单）
    return gateway.languageModel("anthropic/claude-haiku-4.5");
  }
  // 文本和表格用 Sonnet（需要更好的格式控制）
  return gateway.languageModel("anthropic/claude-sonnet-4.5");
}
```

**选项 C: 让用户选择**
```typescript
export function getArtifactModel(userPreference?: string) {
  return gateway.languageModel(
    userPreference || "anthropic/claude-sonnet-4.5"
  );
}
```

### 方案 2: 传递更多上下文给 Sub-Agent

**方案 2A: 扩展 createDocument 的参数**

```typescript
// 修改 tool 定义
export const createDocument = ({ session, dataStream }: CreateDocumentProps) =>
  tool({
    inputSchema: z.object({
      title: z.string(),
      kind: z.enum(artifactKinds),
      // 新增：详细的内容要求
      requirements: z.string().optional().describe(
        "Detailed requirements and context for the document"
      ),
      // 新增：背景知识
      context: z.string().optional().describe(
        "Background knowledge and research findings"
      ),
    }),
    execute: async ({ title, kind, requirements, context }) => {
      await documentHandler.onCreateDocument({
        id,
        title,
        requirements,  // 传递详细要求
        context,       // 传递背景知识
        dataStream,
        session,
      });
    },
  });

// 修改 handler 接口
export type CreateDocumentCallbackProps = {
  id: string;
  title: string;
  requirements?: string;  // 新增
  context?: string;       // 新增
  dataStream: UIMessageStreamWriter<ChatMessage>;
  session: Session;
};

// Sub-Agent 使用更丰富的 prompt
onCreateDocument: async ({ title, requirements, context, dataStream }) => {
  const systemPrompt = `You are a professional writing assistant.
Write about the given topic using the provided context and requirements.
Markdown is supported. Use headings wherever appropriate.

${context ? `Background Knowledge:\n${context}\n\n` : ''}
${requirements ? `Requirements:\n${requirements}\n\n` : ''}`;

  const { fullStream } = streamText({
    model: getArtifactModel(),
    system: systemPrompt,
    prompt: title,
  });
}
```

**方案 2B: 让主 Agent 生成详细的写作大纲**

```typescript
// 主 Agent 先生成大纲，再传递给 Sub-Agent
export const createDocument = ({ session, dataStream }: CreateDocumentProps) =>
  tool({
    inputSchema: z.object({
      title: z.string(),
      kind: z.enum(artifactKinds),
      outline: z.string().describe(
        "Detailed outline or structure for the document"
      ),
      keyPoints: z.array(z.string()).describe(
        "Key points to cover in the document"
      ),
    }),
    // ...
  });
```

**方案 2C: 使用对话历史作为上下文**

```typescript
// 传递最近的对话历史
export type CreateDocumentCallbackProps = {
  id: string;
  title: string;
  conversationHistory?: ChatMessage[];  // 新增：对话历史
  dataStream: UIMessageStreamWriter<ChatMessage>;
  session: Session;
};

// Sub-Agent 可以看到完整的对话上下文
onCreateDocument: async ({ title, conversationHistory, dataStream }) => {
  const { fullStream } = streamText({
    model: getArtifactModel(),
    messages: [
      ...conversationHistory,  // 包含主 Agent 的所有思考和检索结果
      { role: "user", content: `Now write a document about: ${title}` }
    ],
  });
}
```

### 方案 3: 重新定位 Sub-Agent

**新定位**: Sub-Agent 应该是一个"有上下文的专业写作助手"

```typescript
// 给 Sub-Agent 访问工具的能力
onCreateDocument: async ({ title, dataStream, session }) => {
  const { fullStream } = streamText({
    model: getArtifactModel(),
    system: `You are a professional writing assistant with access to knowledge base.
You can search for information if needed.`,
    prompt: title,
    tools: {
      // 给 Sub-Agent 访问知识库的能力
      searchKnowledge: knowledgeSearchTool,
    },
  });
}
```

## 推荐的综合方案

结合以上分析，推荐采用以下综合方案：

### 第一步：升级模型（立即可行）
```typescript
export function getArtifactModel(kind?: ArtifactKind) {
  // 默认使用 Sonnet 以保证质量
  return gateway.languageModel("anthropic/claude-sonnet-4.5");
}
```

### 第二步：扩展上下文传递（中期改进）
```typescript
// 修改 createDocument 接受更多参数
inputSchema: z.object({
  title: z.string(),
  kind: z.enum(artifactKinds),
  context: z.string().optional(),      // 背景知识
  requirements: z.string().optional(), // 详细要求
})
```

### 第三步：优化 Prompt（立即可行）
```typescript
// 改进 system prompt，明确要求格式规范
system: `You are a professional writing assistant.
Write high-quality content with proper formatting.

IMPORTANT for Markdown tables:
- Ensure all columns are properly aligned
- Use consistent spacing
- Double-check table syntax

${context ? `Context:\n${context}\n\n` : ''}
${requirements ? `Requirements:\n${requirements}` : ''}`
```

这样可以显著提升 artifact 的生成质量！

