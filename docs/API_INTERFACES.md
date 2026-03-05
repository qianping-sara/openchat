# OpenChat API 接口文档

本文档整理了项目前后端一体的 API 接口，包括各自的请求/响应结构。

---

## 通用说明

- **认证**：多数接口需要用户登录，未登录返回 `401 Unauthorized`
- **错误格式**：业务错误统一返回 `{ code: string, message: string, cause?: string }`
- **Base URL**：相对路径，如 `/api/chat` 即 `{origin}/api/chat`

---

## 1. 聊天 API `/api/chat`

### 1.1 POST - 发送消息（流式）

**请求**

- **Content-Type**: `application/json`
- **Body** (由 `postRequestBodySchema` 校验):

```typescript
{
  id: string;                    // UUID，会话 ID
  message?: {                    // 单条新消息（首次发送或普通续写）
    id: string;                  // UUID
    role: "user";
    parts: Array<{
      type: "text";
      text: string;              // 1-2000 字符
    } | {
      type: "file";
      mediaType: "image/jpeg" | "image/png";
      name: string;              // 1-100 字符
      url: string;               // URL
    }>;
  };
  messages?: Array<{             // 全部消息（工具审批流程续写时使用）
    id: string;
    role: string;
    parts: any[];
  }>;
  selectedChatModel: string;     // 模型 ID，如 "openai/gpt-4o"
  selectedVisibilityType: "public" | "private";
}
```

- **说明**：`message` 与 `messages` 二选一；普通对话传 `message`，工具审批续写传 `messages`。

**响应**

- **Content-Type**: `text/event-stream`（流式 SSE）
- **格式**：Vercel AI SDK 的 `UIMessageStream`，包含多种 event 类型，如：
  - `text-start`, `text-delta`, `text-end`
  - `data-chat-title`（生成标题时）
  - `tool-call`, `tool-result`, `tool-error` 等

**错误**

- `400` - 请求体校验失败 (`bad_request:api`)
- `401` - 未登录 (`unauthorized:chat`)
- `403` - 无权访问该会话 (`forbidden:chat`)
- `429` - 超出每日消息限制 (`rate_limit:chat`)

---

### 1.2 DELETE - 删除单个会话

**请求**

- **Method**: `DELETE`
- **Query**:
  - `id` (必需): 会话 UUID

**示例**: `DELETE /api/chat?id={chatId}`

**响应**

- **Content-Type**: `application/json`
- **Body**: 被删除的 Chat 对象

```typescript
{
  id: string;
  createdAt: string;   // ISO 8601
  title: string;
  userId: string;
  visibility: "public" | "private";
}
```

**错误**

- `400` - 缺少 `id` (`bad_request:api`)
- `401` - 未登录 (`unauthorized:chat`)
- `403` - 无权删除 (`forbidden:chat`)

---

## 2. 历史记录 API `/api/history`

### 2.1 GET - 获取会话列表（分页）

**请求**

- **Query**:
  - `limit` (可选): 每页数量，默认 10
  - `starting_after` (可选): 游标，取该 ID 之后更新的会话
  - `ending_before` (可选): 游标，取该 ID 之前更新的会话
  - **注意**：`starting_after` 与 `ending_before` 不可同时传

**示例**:
- `GET /api/history?limit=20`
- `GET /api/history?limit=20&ending_before={chatId}`

**响应**

```typescript
{
  chats: Array<{
    id: string;
    createdAt: string;   // ISO 8601
    title: string;
    userId: string;
    visibility: "public" | "private";
  }>;
  hasMore: boolean;      // 是否还有更多
}
```

**错误**

- `400` - 同时传了 `starting_after` 和 `ending_before`
- `401` - 未登录 (`unauthorized:chat`)

---

### 2.2 DELETE - 删除当前用户全部会话

**请求**

- **Method**: `DELETE`
- **Body**: 无

**示例**: `DELETE /api/history`

**响应**

```typescript
{
  deletedCount: number;
}
```

**错误**

- `401` - 未登录 (`unauthorized:chat`)

---

## 4. 投票 API `/api/vote`

### 4.1 GET - 获取会话内投票

**请求**

- **Query**:
  - `chatId` (必需): 会话 UUID

**示例**: `GET /api/vote?chatId={chatId}`

**响应**

```typescript
Array<{
  chatId: string;
  messageId: string;
  isUpvoted: boolean;
}>;
```

**错误**

- `400` - 缺少 `chatId`
- `401` - 未登录 (`unauthorized:vote`)
- `403` - 无权访问 (`forbidden:vote`)
- `404` - 会话不存在 (`not_found:vote`)

---

### 4.2 PATCH - 对消息投票

**请求**

- **Method**: `PATCH`
- **Content-Type**: `application/json`
- **Body**:

```typescript
{
  chatId: string;
  messageId: string;
  type: "up" | "down";
}
```

**示例**: `PATCH /api/vote` + Body

**响应**

- **Body**: 纯文本 `"Message voted"`
- **Status**: 200

**错误**

- `400` - 缺少 `chatId`、`messageId` 或 `type`
- `401` - 未登录 (`unauthorized:vote`)
- `403` / `404` - 无权访问或会话不存在



---

## 9. 前端调用汇总

| 功能         | 接口                          | 调用位置                    |
|--------------|-------------------------------|-----------------------------|
| 发送消息     | POST /api/chat                | `components/chat.tsx` (useChat) |
| 删除会话     | DELETE /api/chat?id=          | `components/sidebar-history.tsx` |
| 会话列表     | GET /api/history              | `components/sidebar-history.tsx` (SWR) |
| 删除全部会话 | DELETE /api/history           | `components/app-sidebar.tsx` |
| 投票列表     | GET /api/vote?chatId=         | `components/chat.tsx`, `message-actions.tsx` |
| 投票         | PATCH /api/vote               | `components/message-actions.tsx` |
---

## 10. 错误码说明

统一错误响应格式：

```json
{
  "code": "{type}:{surface}",
  "message": "用户可读错误信息",
  "cause": "可选的详细原因"
}
```

常见 `code` 示例：

- `bad_request:api` - 请求参数错误
- `unauthorized:chat` - 未登录
- `forbidden:chat` - 无权限访问
- `rate_limit:chat` - 消息超限
- `offline:chat` - 服务异常

HTTP 状态码：400 / 401 / 403 / 404 / 429 / 500 / 503
