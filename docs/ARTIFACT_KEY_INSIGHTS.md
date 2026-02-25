# Artifact 系统关键洞察

## 核心设计理念

### 1. 双 Agent 架构的优势

**为什么需要两个 Agent？**

- **主 Agent (对话 Agent)**:
  - 理解用户意图
  - 管理对话流程
  - 决定何时创建/更新 artifact
  - 提供自然语言反馈

- **Sub-Agent (内容生成 Agent)**:
  - 专注于特定类型内容的生成
  - 使用专门的 prompt 和 schema
  - 可以使用不同的模型（如更快的模型）
  - 独立的上下文管理

**好处**:
- ✅ 职责清晰，易于维护
- ✅ 可以为不同类型的 artifact 优化不同的 prompt
- ✅ 主 Agent 不需要关心内容生成的细节
- ✅ 可以并行优化两个 Agent 的性能

### 2. DataStream 的巧妙设计

**为什么使用 dataStream 而不是直接返回结果？**

```typescript
// ❌ 不好的设计：等待完成后返回
const result = await generateContent(title);
return result; // 用户需要等待很久

// ✅ 好的设计：流式传输
for await (const chunk of stream) {
  dataStream.write({ type: "data-textDelta", data: chunk });
  // 用户立即看到进度
}
```

**关键特性**:
- `transient: true` - 数据不保存到消息历史
- 类型安全 - 通过 `CustomUIDataTypes` 定义所有可能的数据类型
- 双向通信 - 前端可以通过 toolbar 发送新消息

### 3. 工具层的桥接作用

**createDocument/updateDocument 不直接生成内容，而是：**

1. **准备阶段**: 生成 ID，发送元数据
2. **委托阶段**: 查找并调用对应的 handler
3. **完成阶段**: 发送完成信号，返回摘要

**这样设计的好处**:
- 主 Agent 只看到简单的工具接口
- 实际的内容生成逻辑封装在 handler 中
- 易于添加新的 artifact 类型

## 关键交互模式

### 模式 1: 元数据先行

```
1. data-kind   → 前端知道要渲染什么类型的编辑器
2. data-id     → 前端知道文档 ID，可以保存编辑
3. data-title  → 前端显示标题
4. data-clear  → 前端清空内容区，准备接收新内容
5. data-*Delta → 开始流式传输实际内容
6. data-finish → 前端知道生成完成，可以编辑
```

### 模式 2: 增量更新

```typescript
// 前端累积内容
setArtifact((prev) => ({
  ...prev,
  content: prev.content + newChunk, // 追加而不是替换
}));
```

### 模式 3: 自动显示控制

```typescript
// textArtifact 的智能显示逻辑
isVisible:
  draftArtifact.status === "streaming" &&
  newContent.length > 400 &&
  newContent.length < 450
    ? true  // 内容达到一定长度时自动显示
    : draftArtifact.isVisible
```

## 不同 Artifact 类型的差异

| 特性 | Text | Code | Sheet |
|------|------|------|-------|
| **Sub-Agent API** | `streamText()` | `streamObject()` | `streamObject()` |
| **输出格式** | 纯文本/Markdown | JSON `{code: string}` | JSON `{csv: string}` |
| **Delta 类型** | `data-textDelta` | `data-codeDelta` | `data-sheetDelta` |
| **编辑器** | ProseMirror | CodeMirror | Spreadsheet |
| **特殊功能** | Suggestions | 代码执行 | CSV 解析 |

### Code Artifact 的特殊之处

```typescript
// 使用 streamObject 确保输出是有效的 JSON
const { fullStream } = streamObject({
  schema: z.object({
    code: z.string(),
  }),
});

// 只在 object 完整时更新（避免显示不完整的代码）
if (delta.type === "object") {
  const { code } = delta.object;
  if (code) {
    dataStream.write({ type: "data-codeDelta", data: code });
  }
}
```

## 状态管理策略

### 1. 使用 SWR 而不是 useState

```typescript
// ✅ 使用 SWR - 自动缓存、重新验证
const { artifact, setArtifact } = useArtifact();

// SWR 内部实现
const { data, mutate } = useSWR<UIArtifact>("artifact", null, {
  fallbackData: initialArtifactData,
});
```

**好处**:
- 自动去重请求
- 自动重新验证
- 乐观更新
- 全局状态共享

### 2. 文档版本管理

```typescript
// 每次保存都创建新版本
await saveDocument({
  id: document.id,        // 相同的 ID
  title: document.title,
  content: newContent,    // 新内容
  kind: document.kind,
  userId: session.user.id,
});

// 前端可以查看所有版本
const { data: documents } = useSWR<Document[]>(
  `/api/document?id=${artifact.documentId}`
);
```

## 扩展性设计

### 添加新的 Artifact 类型只需 5 步

1. **定义类型**:
```typescript
// lib/artifacts/server.ts
export const artifactKinds = ["text", "code", "sheet", "diagram"] as const;
```

2. **创建 Server Handler**:
```typescript
// artifacts/diagram/server.ts
export const diagramDocumentHandler = createDocumentHandler<"diagram">({
  kind: "diagram",
  onCreateDocument: async ({ title, dataStream }) => {
    // 使用 Sub-Agent 生成 Mermaid 代码
  },
  onUpdateDocument: async ({ document, description, dataStream }) => {
    // 更新逻辑
  },
});
```

3. **创建 Client Definition**:
```typescript
// artifacts/diagram/client.tsx
export const diagramArtifact = new Artifact<"diagram">({
  kind: "diagram",
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === "data-diagramDelta") {
      setArtifact((prev) => ({ ...prev, content: streamPart.data }));
    }
  },
  content: ({ content }) => <MermaidRenderer code={content} />,
});
```

4. **注册 Handler**:
```typescript
// lib/artifacts/server.ts
export const documentHandlersByArtifactKind = [
  textDocumentHandler,
  codeDocumentHandler,
  sheetDocumentHandler,
  diagramDocumentHandler, // 新增
];
```

5. **注册 Definition**:
```typescript
// components/artifact.tsx
export const artifactDefinitions = [
  textArtifact,
  codeArtifact,
  sheetArtifact,
  diagramArtifact, // 新增
];
```

## 性能优化技巧

### 1. 防抖保存

```typescript
const debouncedSaveContent = useDebounceCallback(
  (content: string) => {
    mutate(/* 保存到服务器 */);
  },
  2000 // 2 秒后保存
);
```

### 2. 乐观更新

```typescript
mutate(
  `/api/document?id=${id}`,
  async (currentDocuments) => {
    // 立即更新 UI
    const newDocument = { ...currentDocument, content: updatedContent };
    
    // 后台发送请求
    await fetch(`/api/document?id=${id}`, {
      method: "POST",
      body: JSON.stringify({ content: updatedContent }),
    });
    
    return [...currentDocuments, newDocument];
  },
  { revalidate: false } // 不重新验证
);
```

### 3. 条件渲染

```typescript
// 只在需要时才获取文档
const { data: documents } = useSWR<Document[]>(
  artifact.documentId !== "init" && artifact.status !== "streaming"
    ? `/api/document?id=${artifact.documentId}`
    : null, // null 表示不发送请求
  fetcher
);
```

## 总结

Artifact 系统是一个精心设计的**双 Agent + 流式传输**架构：

1. **主 Agent** 负责对话和决策
2. **Sub-Agent** 负责专业内容生成
3. **DataStream** 提供实时通信通道
4. **工具层** 作为桥梁连接两者
5. **前端** 响应式地展示生成过程

这种设计既保证了用户体验（实时反馈），又保证了代码质量（职责分离、易扩展）。

