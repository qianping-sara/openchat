# Artifact 系统快速参考

## 文件结构速查

```
openchat/
├── app/(chat)/api/chat/route.ts          # 主 Agent 入口
├── lib/
│   ├── ai/tools/
│   │   ├── create-document.ts            # 创建 artifact 工具
│   │   └── update-document.ts            # 更新 artifact 工具
│   ├── artifacts/
│   │   └── server.ts                     # Handler 工厂和注册
│   └── types.ts                          # 类型定义
├── artifacts/
│   ├── text/
│   │   ├── server.ts                     # Text Sub-Agent
│   │   └── client.tsx                    # Text 前端定义
│   ├── code/
│   │   ├── server.ts                     # Code Sub-Agent
│   │   └── client.tsx                    # Code 前端定义
│   └── sheet/
│       ├── server.ts                     # Sheet Sub-Agent
│       └── client.tsx                    # Sheet 前端定义
└── components/
    ├── data-stream-provider.tsx          # DataStream Context
    ├── data-stream-handler.tsx           # 处理流式数据
    ├── artifact.tsx                      # Artifact UI 组件
    └── create-artifact.tsx               # Artifact 类定义
```

## 数据流类型速查

### CustomUIDataTypes (lib/types.ts)

```typescript
type CustomUIDataTypes = {
  // 内容增量
  textDelta: string;      // 文本内容片段
  codeDelta: string;      // 代码内容片段
  sheetDelta: string;     // 表格内容片段
  
  // 元数据
  id: string;             // 文档 UUID
  title: string;          // 文档标题
  kind: ArtifactKind;     // "text" | "code" | "sheet"
  
  // 控制信号
  clear: null;            // 清空内容
  finish: null;           // 生成完成
  
  // 其他
  suggestion: Suggestion; // 建议
  appendMessage: string;  // 追加消息
  "chat-title": string;   // 聊天标题
};
```

## 关键 API 速查

### 1. 创建 Document Handler

```typescript
import { createDocumentHandler } from "@/lib/artifacts/server";

export const myDocumentHandler = createDocumentHandler<"mytype">({
  kind: "mytype",
  
  onCreateDocument: async ({ id, title, dataStream, session }) => {
    let content = "";
    
    // 启动 Sub-Agent
    const { fullStream } = streamText({
      model: getArtifactModel(),
      system: "Your system prompt",
      prompt: title,
    });
    
    // 流式传输
    for await (const delta of fullStream) {
      if (delta.type === "text-delta") {
        content += delta.text;
        dataStream.write({
          type: "data-mytypeDelta",
          data: delta.text,
          transient: true,
        });
      }
    }
    
    return content; // 会自动保存到数据库
  },
  
  onUpdateDocument: async ({ document, description, dataStream, session }) => {
    // 类似的更新逻辑
  },
});
```

### 2. 创建 Artifact 定义

```typescript
import { Artifact } from "@/components/create-artifact";

export const myArtifact = new Artifact<"mytype", MyMetadata>({
  kind: "mytype",
  description: "Description for AI to understand when to use this",
  
  // 初始化（可选）
  initialize: async ({ documentId, setMetadata }) => {
    const data = await fetchSomeData(documentId);
    setMetadata(data);
  },
  
  // 处理流式数据
  onStreamPart: ({ streamPart, setArtifact, setMetadata }) => {
    if (streamPart.type === "data-mytypeDelta") {
      setArtifact((prev) => ({
        ...prev,
        content: prev.content + streamPart.data,
        status: "streaming",
      }));
    }
  },
  
  // 渲染内容
  content: ({ content, status, onSaveContent, metadata }) => {
    return <MyEditor content={content} onSave={onSaveContent} />;
  },
  
  // 工具栏操作
  actions: [
    {
      icon: <CopyIcon />,
      description: "Copy",
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
      },
    },
  ],
  
  // 快捷操作
  toolbar: [
    {
      icon: <MagicIcon />,
      description: "Improve",
      onClick: ({ sendMessage }) => {
        sendMessage({
          role: "user",
          parts: [{ type: "text", text: "Improve this" }],
        });
      },
    },
  ],
});
```

### 3. 注册新的 Artifact

```typescript
// 1. lib/artifacts/server.ts
export const artifactKinds = ["text", "code", "sheet", "mytype"] as const;

export const documentHandlersByArtifactKind = [
  textDocumentHandler,
  codeDocumentHandler,
  sheetDocumentHandler,
  myDocumentHandler, // 添加
];

// 2. components/artifact.tsx
export const artifactDefinitions = [
  textArtifact,
  codeArtifact,
  sheetArtifact,
  myArtifact, // 添加
];

// 3. lib/types.ts
export type CustomUIDataTypes = {
  // ... 其他类型
  mytypeDelta: string, // 添加
};
```

## 常用模式速查

### 模式 1: 流式文本生成

```typescript
const { fullStream } = streamText({
  model: getArtifactModel(),
  system: "System prompt",
  prompt: userInput,
});

for await (const delta of fullStream) {
  if (delta.type === "text-delta") {
    dataStream.write({
      type: "data-textDelta",
      data: delta.text,
      transient: true,
    });
  }
}
```

### 模式 2: 结构化对象生成

```typescript
const { fullStream } = streamObject({
  model: getArtifactModel(),
  system: "System prompt",
  prompt: userInput,
  schema: z.object({
    code: z.string(),
    language: z.string(),
  }),
});

for await (const delta of fullStream) {
  if (delta.type === "object") {
    const { code } = delta.object;
    if (code) {
      dataStream.write({
        type: "data-codeDelta",
        data: code,
        transient: true,
      });
    }
  }
}
```

### 模式 3: 前端累积更新

```typescript
onStreamPart: ({ streamPart, setArtifact }) => {
  if (streamPart.type === "data-textDelta") {
    setArtifact((prev) => ({
      ...prev,
      content: prev.content + streamPart.data, // 累积
      status: "streaming",
    }));
  }
}
```

### 模式 4: 前端完整替换

```typescript
onStreamPart: ({ streamPart, setArtifact }) => {
  if (streamPart.type === "data-codeDelta") {
    setArtifact((prev) => ({
      ...prev,
      content: streamPart.data, // 替换（因为 streamObject 返回完整对象）
      status: "streaming",
    }));
  }
}
```

## 调试技巧

### 1. 查看 DataStream 内容

```typescript
// components/data-stream-handler.tsx
useEffect(() => {
  if (!dataStream?.length) return;
  
  console.log("📦 DataStream deltas:", dataStream); // 添加日志
  
  for (const delta of dataStream) {
    console.log("🔄 Processing delta:", delta.type, delta.data);
    // ...
  }
}, [dataStream]);
```

### 2. 查看 Artifact 状态

```typescript
// 在任何组件中
const { artifact } = useArtifact();
console.log("🎨 Current artifact:", artifact);
```

### 3. 查看文档历史

```typescript
const { data: documents } = useSWR<Document[]>(
  `/api/document?id=${artifact.documentId}`
);
console.log("📚 Document versions:", documents);
```

## 性能优化清单

- ✅ 使用 `transient: true` 避免数据保存到消息历史
- ✅ 使用 `useDebounceCallback` 防抖保存
- ✅ 使用 SWR 的 `revalidate: false` 避免不必要的请求
- ✅ 条件渲染：只在需要时才获取数据
- ✅ 使用 `memo` 避免不必要的重新渲染
- ✅ 大内容时考虑虚拟滚动

## 常见问题

**Q: 为什么内容没有实时更新？**
A: 检查 `onStreamPart` 是否正确处理了对应的 delta 类型

**Q: 为什么保存失败？**
A: 检查 `session?.user?.id` 是否存在，以及数据库连接

**Q: 如何添加新的 delta 类型？**
A: 在 `lib/types.ts` 的 `CustomUIDataTypes` 中添加

**Q: 如何自定义 Sub-Agent 的模型？**
A: 修改 `getArtifactModel()` 或在 handler 中直接指定模型

**Q: 如何支持多语言？**
A: 在 system prompt 中添加语言指令，或使用 i18n 库

