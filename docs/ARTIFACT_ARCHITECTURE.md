# Artifact 系统架构分析

## 概述

Artifact 系统是一个**双 Agent 架构**，主 Agent 负责对话和决策，Sub-Agent 负责生成具体的 artifact 内容（文本、代码、表格等）。两者通过 **DataStream** 进行通信。

## 核心组件

### 1. 主 Agent (Main Agent)
- **位置**: `app/(chat)/api/chat/route.ts`
- **技术**: Vercel AI SDK 的 `streamText()`
- **职责**:
  - 理解用户意图
  - 决定是否需要创建/更新 artifact
  - 调用 `createDocument` 或 `updateDocument` tool
  - 生成对话响应

### 2. Tools (工具层)

#### createDocument Tool
- **位置**: `lib/ai/tools/create-document.ts`
- **输入**: `{ title: string, kind: "text" | "code" | "sheet" }`
- **流程**:
  1. 生成唯一 UUID
  2. 通过 dataStream 写入元数据 (kind, id, title, clear)
  3. 查找对应的 documentHandler
  4. 委托给 handler 的 `onCreateDocument()`
  5. 写入 "data-finish" 信号
  6. 返回摘要给主 Agent

#### updateDocument Tool
- **位置**: `lib/ai/tools/update-document.ts`
- **输入**: `{ id: string, description: string }`
- **流程**:
  1. 从数据库获取现有文档
  2. 写入 "data-clear" 清空前端显示
  3. 查找对应的 documentHandler
  4. 委托给 handler 的 `onUpdateDocument()`
  5. 写入 "data-finish" 信号
  6. 返回更新成功消息

### 3. Document Handlers (文档处理器)

**位置**: `lib/artifacts/server.ts`

每种 artifact 类型都有对应的 handler:
- `textDocumentHandler` - 文本文档
- `codeDocumentHandler` - 代码
- `sheetDocumentHandler` - 表格

**Handler 结构**:
```typescript
{
  kind: "text" | "code" | "sheet",
  onCreateDocument: async (params) => void,
  onUpdateDocument: async (params) => void
}
```

**Handler 职责**:
1. 启动对应的 Sub-Agent
2. 将 Sub-Agent 生成的内容通过 dataStream 流式传输
3. 生成完成后保存到数据库
4. 返回完整内容

### 4. Sub-Agents (子 Agent)

每个 handler 内部启动一个专门的 AI Agent:

#### Text Sub-Agent
- **位置**: `artifacts/text/server.ts`
- **技术**: `streamText()`
- **输出**: 通过 `data-textDelta` 流式传输 Markdown 文本

#### Code Sub-Agent
- **位置**: `artifacts/code/server.ts`
- **技术**: `streamObject()` with schema
- **输出**: 通过 `data-codeDelta` 流式传输代码

#### Sheet Sub-Agent
- **位置**: `artifacts/sheet/server.ts`
- **技术**: `streamObject()` with CSV schema
- **输出**: 通过 `data-sheetDelta` 流式传输 CSV 数据

### 5. DataStream (数据流)

**类型**: `UIMessageStreamWriter<ChatMessage>`

**作用**: 在服务端和客户端之间传输实时数据

**数据类型** (定义在 `lib/types.ts`):
```typescript
type CustomUIDataTypes = {
  textDelta: string;      // 文本增量
  codeDelta: string;      // 代码增量
  sheetDelta: string;     // 表格增量
  id: string;             // 文档 ID
  title: string;          // 文档标题
  kind: ArtifactKind;     // 文档类型
  clear: null;            // 清空信号
  finish: null;           // 完成信号
  // ...
}
```

### 6. 前端组件

#### DataStreamProvider
- **位置**: `components/data-stream-provider.tsx`
- **职责**: 提供全局的 dataStream 状态管理

#### DataStreamHandler
- **位置**: `components/data-stream-handler.tsx`
- **职责**: 
  - 监听 dataStream 变化
  - 根据 delta.type 更新 artifact 状态
  - 调用对应 artifact 的 `onStreamPart()` 方法

#### Artifact Component
- **位置**: `components/artifact.tsx`
- **职责**: 渲染 artifact UI，显示生成的内容

#### Artifact Definitions
- **位置**: `artifacts/*/client.tsx`
- **职责**: 定义每种 artifact 的前端行为
  - `onStreamPart`: 处理流式数据
  - `content`: 渲染组件
  - `actions`: 工具栏操作
  - `toolbar`: 快捷操作

## 数据流向

### 创建 Artifact 流程

```
用户输入 "创建博客文章"
  ↓
主 Agent 分析 → 决定调用 createDocument({title: "博客文章", kind: "text"})
  ↓
createDocument Tool:
  1. 生成 UUID
  2. dataStream.write({type: "data-id", data: uuid})
  3. dataStream.write({type: "data-kind", data: "text"})
  4. dataStream.write({type: "data-title", data: "博客文章"})
  5. dataStream.write({type: "data-clear"})
  ↓
查找 textDocumentHandler → 调用 onCreateDocument()
  ↓
启动 Text Sub-Agent (streamText)
  ↓
Sub-Agent 生成内容:
  for each chunk:
    dataStream.write({type: "data-textDelta", data: chunk})
  ↓
前端 DataStreamHandler 接收:
  - 更新 artifact.content += chunk
  - 实时显示在 UI
  ↓
生成完成:
  1. saveDocument() 保存到数据库
  2. dataStream.write({type: "data-finish"})
  3. 返回给主 Agent
  ↓
主 Agent 继续生成对话响应: "我已经为你创建了博客文章..."
```

## 关键设计模式

### 1. 策略模式 (Strategy Pattern)
- 不同类型的 artifact 有不同的 handler
- 通过 `documentHandlersByArtifactKind` 数组动态查找

### 2. 观察者模式 (Observer Pattern)
- DataStreamHandler 监听 dataStream 变化
- 自动更新 UI 状态

### 3. 工厂模式 (Factory Pattern)
- `createDocumentHandler()` 工厂函数创建标准化的 handler

### 4. 流式处理 (Streaming)
- 使用 SSE (Server-Sent Events) 实时传输数据
- 提供更好的用户体验

## 扩展新的 Artifact 类型

要添加新的 artifact 类型（如 "diagram"），需要:

1. **定义类型**: 在 `lib/artifacts/server.ts` 添加到 `artifactKinds`
2. **创建 Server Handler**: `artifacts/diagram/server.ts`
3. **创建 Client Definition**: `artifacts/diagram/client.tsx`
4. **注册 Handler**: 添加到 `documentHandlersByArtifactKind`
5. **注册 Definition**: 添加到 `artifactDefinitions`
6. **更新类型**: 在 `lib/types.ts` 添加 `diagramDelta: string`

## 代码示例

### 1. 主 Agent 如何注册 Tools

```typescript
// app/(chat)/api/chat/route.ts
const stream = createUIMessageStream({
  execute: async ({ writer: dataStream }) => {
    const allTools = {
      // 传递 session 和 dataStream 给 tools
      createDocument: createDocument({ session, dataStream }),
      updateDocument: updateDocument({ session, dataStream }),
      // ... 其他 tools
    };

    const agent = new ToolLoopAgent({
      model: getLanguageModel(selectedChatModel),
      instructions: systemPrompt({ selectedChatModel, requestHints }),
      tools: allTools,
      stopWhen: stepCountIs(20),
    });

    const result = await agent.stream({
      messages: modelMessages,
    });
  }
});
```

### 2. createDocument Tool 实现

```typescript
// lib/ai/tools/create-document.ts
export const createDocument = ({ session, dataStream }: CreateDocumentProps) =>
  tool({
    description: "Create a document for writing or content creation activities.",
    inputSchema: z.object({
      title: z.string(),
      kind: z.enum(["text", "code", "sheet"]),
    }),
    execute: async ({ title, kind }) => {
      const id = generateUUID();

      // 1. 发送元数据到前端
      dataStream.write({ type: "data-kind", data: kind, transient: true });
      dataStream.write({ type: "data-id", data: id, transient: true });
      dataStream.write({ type: "data-title", data: title, transient: true });
      dataStream.write({ type: "data-clear", data: null, transient: true });

      // 2. 查找对应的 handler
      const documentHandler = documentHandlersByArtifactKind.find(
        (h) => h.kind === kind
      );

      // 3. 委托给 handler 生成内容
      await documentHandler.onCreateDocument({
        id,
        title,
        dataStream,
        session,
      });

      // 4. 发送完成信号
      dataStream.write({ type: "data-finish", data: null, transient: true });

      // 5. 返回给主 Agent
      return {
        id,
        title,
        kind,
        content: "The document has been created successfully.",
      };
    },
  });
```

### 3. Text Document Handler 实现

```typescript
// artifacts/text/server.ts
export const textDocumentHandler = createDocumentHandler<"text">({
  kind: "text",
  onCreateDocument: async ({ title, dataStream }) => {
    let draftContent = "";

    // 启动 Sub-Agent
    const { fullStream } = streamText({
      model: getArtifactModel(),
      system: "Write about the given topic. Markdown is supported.",
      prompt: title,
    });

    // 流式传输内容
    for await (const delta of fullStream) {
      if (delta.type === "text-delta") {
        const { text } = delta;
        draftContent += text;

        // 发送增量到前端
        dataStream.write({
          type: "data-textDelta",
          data: text,
          transient: true,
        });
      }
    }

    // 返回完整内容（会被 createDocumentHandler 保存到数据库）
    return draftContent;
  },
  onUpdateDocument: async ({ document, description, dataStream }) => {
    let draftContent = "";

    const { fullStream } = streamText({
      model: getArtifactModel(),
      system: updateDocumentPrompt(document.content, "text"),
      prompt: description,
      providerOptions: {
        openai: {
          prediction: {
            type: "content",
            content: document.content, // 使用原内容作为预测
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

### 4. 前端 DataStreamHandler 处理

```typescript
// components/data-stream-handler.tsx
export function DataStreamHandler() {
  const { dataStream, setDataStream } = useDataStream();
  const { artifact, setArtifact, setMetadata } = useArtifact();

  useEffect(() => {
    if (!dataStream?.length) return;

    const newDeltas = dataStream.slice();
    setDataStream([]);

    for (const delta of newDeltas) {
      // 1. 调用 artifact 定义的 onStreamPart
      const artifactDefinition = artifactDefinitions.find(
        (def) => def.kind === artifact.kind
      );

      if (artifactDefinition?.onStreamPart) {
        artifactDefinition.onStreamPart({
          streamPart: delta,
          setArtifact,
          setMetadata,
        });
      }

      // 2. 处理通用的元数据
      setArtifact((draftArtifact) => {
        switch (delta.type) {
          case "data-id":
            return {
              ...draftArtifact,
              documentId: delta.data,
              status: "streaming",
              isVisible: true, // 自动显示 artifact 面板
            };

          case "data-title":
            return { ...draftArtifact, title: delta.data };

          case "data-kind":
            return { ...draftArtifact, kind: delta.data };

          case "data-clear":
            return { ...draftArtifact, content: "" };

          case "data-finish":
            return { ...draftArtifact, status: "idle" };

          default:
            return draftArtifact;
        }
      });
    }
  }, [dataStream, setArtifact, setMetadata, artifact, setDataStream]);

  return null;
}
```

### 5. Text Artifact 客户端定义

```typescript
// artifacts/text/client.tsx
export const textArtifact = new Artifact<"text", TextArtifactMetadata>({
  kind: "text",
  description: "Useful for text content, like drafting essays and emails.",

  // 处理流式数据
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === "data-textDelta") {
      setArtifact((draftArtifact) => {
        const newContent = (draftArtifact.content || "") + streamPart.data;
        return {
          ...draftArtifact,
          content: newContent,
          // 当内容达到一定长度时自动显示
          isVisible:
            draftArtifact.status === "streaming" &&
            newContent.length > 400 &&
            newContent.length < 450
              ? true
              : draftArtifact.isVisible,
          status: "streaming",
        };
      });
    }
  },

  // 渲染内容
  content: ({ content, status, onSaveContent }) => {
    return (
      <Editor
        content={content}
        onSaveContent={onSaveContent}
        status={status}
      />
    );
  },

  // 工具栏操作
  actions: [
    {
      icon: <CopyIcon />,
      description: "Copy to clipboard",
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success("Copied!");
      },
    },
  ],
});
```

## 关键交互点

### 1. dataStream 的 transient 标志
所有 artifact 相关的数据都标记为 `transient: true`，这意味着:
- 这些数据不会被保存到消息历史
- 只用于实时 UI 更新
- 不会影响对话上下文

### 2. 双向通信
- **Server → Client**: 通过 dataStream 发送实时更新
- **Client → Server**: 用户可以通过 toolbar 发送新消息继续修改

### 3. 版本管理
- 每次更新都会创建新的 document 版本
- 前端可以查看历史版本和 diff
- 使用 SWR 缓存文档历史

## 总结

Artifact 系统的核心优势:
- ✅ **职责分离**: 主 Agent 负责对话，Sub-Agent 负责内容生成
- ✅ **实时反馈**: 流式传输提供即时的用户体验
- ✅ **可扩展**: 易于添加新的 artifact 类型
- ✅ **类型安全**: TypeScript 提供完整的类型检查
- ✅ **状态管理**: 使用 SWR 进行高效的客户端缓存
- ✅ **版本控制**: 自动保存每次修改的历史版本

## 与主 Agent 的互动模式

1. **主 Agent 作为协调者**: 决定何时创建/更新 artifact
2. **Sub-Agent 作为专家**: 专注于生成高质量的特定类型内容
3. **工具作为桥梁**: 连接两个 Agent 并管理数据流
4. **DataStream 作为通道**: 实时传输数据到前端
5. **前端作为展示层**: 响应式地显示生成过程和结果

