# Artifact 系统改进代码示例

## 改进 1: 升级 Sub-Agent 模型

### 当前代码
```typescript
// lib/ai/providers.ts
export function getArtifactModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("artifact-model");
  }
  return gateway.languageModel("anthropic/claude-haiku-4.5"); // ❌ Haiku
}
```

### 改进方案 A: 直接升级到 Sonnet
```typescript
// lib/ai/providers.ts
export function getArtifactModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("artifact-model");
  }
  // ✅ 使用 Sonnet 以获得更好的质量
  return gateway.languageModel("anthropic/claude-sonnet-4.5");
}
```

### 改进方案 B: 根据类型选择模型
```typescript
// lib/ai/providers.ts
export function getArtifactModel(kind?: ArtifactKind) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("artifact-model");
  }
  
  // 根据 artifact 类型选择合适的模型
  switch (kind) {
    case "code":
      // 代码生成可以用 Haiku（格式相对简单）
      return gateway.languageModel("anthropic/claude-haiku-4.5");
    
    case "text":
    case "sheet":
      // 文本和表格需要更好的格式控制，用 Sonnet
      return gateway.languageModel("anthropic/claude-sonnet-4.5");
    
    default:
      return gateway.languageModel("anthropic/claude-sonnet-4.5");
  }
}

// 使用时传入类型
// artifacts/text/server.ts
const { fullStream } = streamText({
  model: getArtifactModel("text"), // ✅ 传入类型
  system: "...",
  prompt: title,
});
```

## 改进 2: 扩展上下文传递

### 步骤 1: 修改类型定义

```typescript
// lib/artifacts/server.ts
export type CreateDocumentCallbackProps = {
  id: string;
  title: string;
  // ✅ 新增：详细的上下文信息
  context?: string;
  requirements?: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  session: Session;
};

export type UpdateDocumentCallbackProps = {
  document: Document;
  description: string;
  // ✅ 新增：额外的上下文
  context?: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  session: Session;
};
```

### 步骤 2: 修改 createDocument Tool

```typescript
// lib/ai/tools/create-document.ts
export const createDocument = ({ session, dataStream }: CreateDocumentProps) =>
  tool({
    description: `Create a document for writing or content creation activities.
This tool will generate the contents of the document based on the title, kind, and optional context.

You should provide:
- title: A clear, descriptive title
- kind: The type of document (text, code, or sheet)
- context: (OPTIONAL) Any background knowledge, research findings, or detailed requirements
- requirements: (OPTIONAL) Specific requirements or constraints for the document`,
    
    inputSchema: z.object({
      title: z.string().describe("The title of the document"),
      kind: z.enum(artifactKinds).describe("The type of document to create"),
      
      // ✅ 新增：可选的上下文字段
      context: z.string().optional().describe(
        "Background knowledge, research findings, or relevant information that should inform the document content"
      ),
      
      requirements: z.string().optional().describe(
        "Specific requirements, constraints, or focus areas for the document"
      ),
    }),
    
    execute: async ({ title, kind, context, requirements }) => {
      const id = generateUUID();

      // 发送元数据...
      dataStream.write({ type: "data-kind", data: kind, transient: true });
      dataStream.write({ type: "data-id", data: id, transient: true });
      dataStream.write({ type: "data-title", data: title, transient: true });
      dataStream.write({ type: "data-clear", data: null, transient: true });

      const documentHandler = documentHandlersByArtifactKind.find(
        (h) => h.kind === kind
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${kind}`);
      }

      // ✅ 传递完整的上下文信息
      await documentHandler.onCreateDocument({
        id,
        title,
        context,        // ✅ 传递背景知识
        requirements,   // ✅ 传递详细要求
        dataStream,
        session,
      });

      dataStream.write({ type: "data-finish", data: null, transient: true });

      return {
        id,
        title,
        kind,
        content: "A document was created and is now visible to the user.",
      };
    },
  });
```

### 步骤 3: 修改 Text Document Handler

```typescript
// artifacts/text/server.ts
export const textDocumentHandler = createDocumentHandler<"text">({
  kind: "text",
  
  onCreateDocument: async ({ title, context, requirements, dataStream }) => {
    let draftContent = "";

    // ✅ 构建更丰富的 system prompt
    let systemPrompt = `You are a professional writing assistant.
Write high-quality, well-structured content about the given topic.
Markdown is supported. Use headings, lists, and formatting appropriately.

IMPORTANT formatting guidelines:
- Use proper Markdown syntax
- For tables: ensure all columns are properly aligned with consistent spacing
- Use headings (##, ###) to structure the content
- Use bullet points or numbered lists where appropriate
`;

    // ✅ 添加背景知识
    if (context) {
      systemPrompt += `\n\nBackground Knowledge and Context:\n${context}\n`;
    }

    // ✅ 添加具体要求
    if (requirements) {
      systemPrompt += `\n\nSpecific Requirements:\n${requirements}\n`;
    }

    const { fullStream } = streamText({
      model: getArtifactModel("text"),
      system: systemPrompt,
      experimental_transform: smoothStream({ chunking: "word" }),
      prompt: title,
    });

    for await (const delta of fullStream) {
      if (delta.type === "text-delta") {
        const { text } = delta;
        draftContent += text;
        dataStream.write({
          type: "data-textDelta",
          data: text,
          transient: true,
        });
      }
    }

    return draftContent;
  },
  
  onUpdateDocument: async ({ document, description, context, dataStream }) => {
    let draftContent = "";

    let systemPrompt = updateDocumentPrompt(document.content, "text");
    
    // ✅ 更新时也可以提供额外上下文
    if (context) {
      systemPrompt += `\n\nAdditional Context:\n${context}\n`;
    }

    const { fullStream } = streamText({
      model: getArtifactModel("text"),
      system: systemPrompt,
      experimental_transform: smoothStream({ chunking: "word" }),
      prompt: description,
      providerOptions: {
        openai: {
          prediction: {
            type: "content",
            content: document.content,
          },
        },
      },
    });

    for await (const delta of fullStream) {
      if (delta.type === "text-delta") {
        const { text } = delta;
        draftContent += text;
        dataStream.write({
          type: "data-textDelta",
          data: text,
          transient: true,
        });
      }
    }

    return draftContent;
  },
});
```

## 使用示例

### 场景：用户请求基于知识库写文章

```typescript
// 主 Agent 的处理流程
async function handleUserRequest(userMessage: string) {
  // 1. 主 Agent 理解用户意图
  // 用户: "帮我写一篇关于越南投资环境的文章，重点分析制造业机会"
  
  // 2. 主 Agent 使用知识检索工具
  const knowledgeResults = await searchKnowledge("越南投资 制造业");
  // 返回: "2024 越南投资专题.md" 的相关内容
  
  // 3. 主 Agent 调用 createDocument，传递完整信息
  await createDocument({
    title: "越南投资环境分析：制造业机会深度解读",
    kind: "text",
    
    // ✅ 传递知识库内容
    context: `根据最新的越南投资专题研究：
- 越南 2024 年 GDP 增长预计 6.5%
- 制造业占 GDP 的 25%
- 主要优势：劳动力成本低、政策优惠、地理位置优越
- 重点园区：河内、胡志明市、海防等
${knowledgeResults}`,
    
    // ✅ 传递用户的具体要求
    requirements: `重点分析以下方面：
1. 制造业的投资机会和优势
2. 主要的工业园区对比
3. 政策优惠和税收政策
4. 风险和挑战
5. 实际案例分析`,
  });
}
```

现在 Sub-Agent 可以生成高质量、有深度的专业文章，而不是泛泛而谈！

