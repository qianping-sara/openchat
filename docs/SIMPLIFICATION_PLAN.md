# 项目精简规划

> 目标：极致精简项目结构，保留基础问答能力
> 
> 三大任务：1) 移除 Neo4j 测试能力  2) 移除认证能力（允许任意用户使用）  3) 移除文档/Artifact 能力

---

## 任务一：移除 Neo4j 测试 API 及关联代码

### 1.1 涉及文件清单

| 操作 | 路径 | 说明 |
|------|------|------|
| 删除 | `app/api/test-neo4j/route.ts` | 测试端点 |
| 删除 | `lib/db/neo4j.ts` | Neo4j 驱动与 read-only 封装 |
| 删除 | `lib/ai/tools/neo4j-tools.ts` | Neo4j AI 工具（当前未在 chat 中引用） |
| 修改 | `package.json` | 移除 `neo4j-driver` 依赖 |
| 修改 | `.env.example` | 移除 Neo4j 相关环境变量说明 |

### 1.2 DB 影响

- **无**。Neo4j 为独立图数据库，不使用 PostgreSQL 表，无需修改 schema 或 migrations。

### 1.3 依赖与引用

- `neo4j-tools.ts` 未被 chat route 引用（chat 使用 `pageindexTools`、`getWeather`、`createDocument` 等）
- 删除后需运行 `pnpm install` 更新 lockfile

---

## 任务二：移除认证能力，允许任意用户使用（方案 B：每访客一匿名用户）

### 2.1 设计原则

- **允许任意用户使用**：无需登录
- **每访客独立会话**：通过 cookie 区分访客，每人有独立 chat 历史（与当前 guest 体验一致）
- **实现方式**：首次访问时创建 User 记录并写入 cookie，后续请求从 cookie 读取 userId

### 2.2 方案 B 核心实现

#### 2.2.1 新增 `lib/anonymous-user.ts`

```typescript
// 职责：为每个访客提供稳定的 userId（通过 cookie 持久化）
import { cookies } from "next/headers";
import { createGuestUser } from "@/lib/db/queries";

const ANON_COOKIE_NAME = "anon_user_id";

export async function getAnonymousUserId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(ANON_COOKIE_NAME)?.value;
  if (existing) return existing;

  const [newUser] = await createGuestUser();
  cookieStore.set(ANON_COOKIE_NAME, newUser.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 年
    path: "/",
  });
  return newUser.id;
}
```

- 复用现有 `createGuestUser()`，无需 migration 或 seed
- cookie 自动随请求发送，API 在 Server 端读取

#### 2.2.2 API 改造模式

**原逻辑**：
```typescript
const session = await auth();
if (!session?.user) return new OpenChatError("unauthorized:chat").toResponse();
const userId = session.user.id;
```

**新逻辑**：
```typescript
const userId = await getAnonymousUserId();
```

### 2.3 涉及文件与详细动作

#### 阶段 A：新增匿名用户模块

| 序号 | 操作 | 路径 | 说明 |
|------|------|------|------|
| A1 | 新建 | `lib/anonymous-user.ts` | 实现 `getAnonymousUserId()`（见 2.2.1） |

#### 阶段 B：API Route 改造

| 序号 | 操作 | 路径 | 具体改动 |
|------|------|------|----------|
| B1 | 修改 | `app/(chat)/api/chat/route.ts` | 移除 `auth` 导入；用 `getAnonymousUserId()` 替代 `session.user.id`；`userType` 固定为 `"guest"`（或移除 entitlements 的 guest/regular 区分）；移除 `type UserType` 等 NextAuth 相关类型 |
| B2 | 修改 | `app/(chat)/api/history/route.ts` | 移除 `auth`；用 `getAnonymousUserId()` 替代 `session.user.id` |
| B3 | 修改 | `app/(chat)/api/vote/route.ts` | 同上（GET 与 PATCH） |
| B4 | 修改 | `app/(chat)/api/files/upload/route.ts` | 同上（`session` 改为 `session?.user` 的判断逻辑 → 直接调用 `getAnonymousUserId()`，无需判断） |

#### 阶段 C：移除认证重定向与校验

| 序号 | 操作 | 路径 | 具体改动 |
|------|------|------|----------|
| C1 | 修改 | `proxy.ts` | 移除 `getToken` 及 guest 重定向；函数体改为 `return NextResponse.next()`（保留 `/ping` 逻辑）；移除 `guestRegex`、`/login`、`/register` 相关分支 |
| C2 | 说明 | middleware | 当前项目无 `middleware.ts`。若 `proxy` 被某处引用为中间件，需一并修改；否则 `proxy.ts` 可能是未使用的遗留文件，确认后决定保留或删除 |

#### 阶段 D：页面与 Layout 改造

| 序号 | 操作 | 路径 | 具体改动 |
|------|------|------|----------|
| D1 | 修改 | `app/(chat)/chat/[id]/page.tsx` | 移除 `auth`、`redirect("/api/auth/guest")`；改为调用 `getAnonymousUserId()` 得到当前访客 userId；`isReadonly={userId !== chat.userId}`（非本人会话只读）；若 `chat.userId !== userId` 且 `chat.visibility === "private"` 则 `notFound()`；若 `!chat` 则 `redirect("/")` |
| D2 | 修改 | `app/(chat)/layout.tsx` | 移除 `auth()`；`AppSidebar user={undefined}` 改为传占位对象以显示历史与删除等：`user={{ id: "anon", email: "Guest", name: "Guest" } as User }`，或新增类型 `AnonymousUser` |
| D3 | 修改 | `app/layout.tsx` | 移除 `SessionProvider` 及其 import |
| D4 | 检查 | `app/(chat)/page.tsx` | 若存在首页且依赖 auth，需同样移除 redirect 等逻辑 |

#### 阶段 E：Sidebar 与用户 UI

| 序号 | 操作 | 路径 | 具体改动 |
|------|------|------|----------|
| E1 | 修改 | `components/sidebar-user-nav.tsx` | 移除 `useSession`、`signOut`、`guestRegex`；保留主题切换；移除「Login to your account」「Sign out」菜单项；或将 `SidebarUserNav` 简化为仅主题切换，若无其他用途可考虑内联到 AppSidebar |
| E2 | 修改 | `components/app-sidebar.tsx` | `user` 类型改为可接受占位（如 `{ id: string; email?: string } | undefined`）；`user && <SidebarUserNav>` 改为始终渲染简化版（或 `user` 传占位后始终有值）；`user &&` 的删除全部会话按钮可改为始终显示（所有人都可删自己的历史） |
| E3 | 修改 | `components/sidebar-history.tsx` | 当 `user` 为占位时不再显示「Login to save and revisit previous chats!」；即 `!user` 时显示该提示，传入占位后应显示历史（因 API 用 cookie 的 userId 返回数据） |

#### 阶段 F：Entitlements 与常量

| 序号 | 操作 | 路径 | 具体改动 |
|------|------|------|----------|
| F1 | 修改 | `lib/ai/entitlements.ts` | 移除 `UserType` 依赖； export 单一 `maxMessagesPerDay`，或 `Record<string, Entitlements>` 只保留一个 key |
| F2 | 修改 | `lib/constants.ts` | 移除 `guestRegex`、`DUMMY_PASSWORD`（若 `generateDummyPassword` 仅 auth 用，需检查 `lib/db/utils.ts` 等是否仍引用） |

#### 阶段 G：删除 Auth 相关

| 序号 | 操作 | 路径 |
|------|------|------|
| G1 | 删除 | `app/(auth)/api/auth/guest/route.ts` |
| G2 | 删除 | `app/(auth)/api/auth/[...nextauth]/route.ts` |
| G3 | 删除 | `app/(auth)/auth.ts` |
| G4 | 删除 | `app/(auth)/auth.config.ts` |
| G5 | 删除 | `app/(auth)/actions.ts` |
| G6 | 删除 | `app/(auth)/login/page.tsx` |
| G7 | 删除 | `app/(auth)/register/page.tsx` |
| G8 | 删除 | `components/auth-form.tsx` |
| G9 | 删除 | `components/sign-out-form.tsx` |
| G10 | 删除 | `app/(auth)/` 整个目录 | 上述文件删除后该目录为空，可整体移除；若有 `layout.tsx` 也一并删除 |

#### 阶段 H：依赖与类型

| 序号 | 操作 | 路径 | 说明 |
|------|------|------|------|
| H1 | 修改 | `package.json` | 移除 `next-auth`、`bcrypt-ts`（用 `pnpm remove next-auth bcrypt-ts`，并确认无其他引用） |
| H2 | 类型 | `components/app-sidebar.tsx`、`sidebar-history.tsx`、`sidebar-user-nav.tsx` | 移除 `next-auth` 的 `User` 类型，改用本地类型如 `{ id: string; email?: string }` |

### 2.4 DB 影响

| 表 | 操作 | 说明 |
|----|------|------|
| User | 保留 | `createGuestUser` 继续用于创建匿名用户 |
| Chat, Message, Vote, Stream | 保留 | 无变更 |

- **无需 migration**，沿用现有 `User` 表与 `createGuestUser`

### 2.5 注意事项

1. **cookie 跨子域**：若存在多子域，需考虑 `domain` 设置。
2. **createGuestUser 依赖**：仅使用 `generateHashedPassword`、`generateUUID`，与 `DUMMY_PASSWORD` 无关。`DUMMY_PASSWORD`、`generateDummyPassword` 仅被 auth 使用，可一并移除。
3. **chat/[id] 权限**：保留 `chat.userId === requestUserId` 校验，非本人会话仍返回 notFound。

---

## 任务三：移除文档/Artifact 能力

### 3.1 涉及文件清单

#### API 路由

| 操作 | 路径 |
|------|------|
| 删除 | `app/(chat)/api/document/route.ts` |
| 删除 | `app/(chat)/api/suggestions/route.ts` |

#### AI 工具

| 操作 | 路径 |
|------|------|
| 删除 | `lib/ai/tools/create-document.ts` |
| 删除 | `lib/ai/tools/update-document.ts` |
| 删除 | `lib/ai/tools/request-suggestions.ts` |

#### Prompts

| 操作 | 路径 | 修改内容 |
|------|------|----------|
| 修改 | `lib/ai/prompts.ts` | 移除 `artifactsPrompt`，移除 `createDocument`/`updateDocument`/`requestSuggestions` 说明；移除 `ArtifactKind` 导入；移除/简化 `textDocumentPrompt`、`sheetPrompt`、`updateTextDocumentPrompt`、`updateDocumentPrompt` 等（若仅 artifact 使用） |

#### Chat Route

| 操作 | 路径 | 修改内容 |
|------|------|----------|
| 修改 | `app/(chat)/api/chat/route.ts` | 从 tools 中移除 `createDocument`、`updateDocument`、`requestSuggestions` |

#### 组件（按依赖层级）

| 操作 | 路径 | 说明 |
|------|------|------|
| 删除 | `components/artifact.tsx` | Artifact 主组件 |
| 删除 | `components/artifact-actions.tsx` | Artifact 操作 |
| 删除 | `components/artifact-close-button.tsx` | 关闭按钮 |
| 删除 | `components/artifact-messages.tsx` | Artifact 消息 |
| 删除 | `components/create-artifact.tsx` | 创建 Artifact |
| 删除 | `components/document.tsx` | 文档工具结果展示 |
| 删除 | `components/document-preview.tsx` | 文档预览 |
| 删除 | `components/document-skeleton.tsx` | 文档骨架屏 |
| 删除 | `components/version-footer.tsx` | 文档版本 footer |
| 删除 | `components/toolbar.tsx` | Artifact 工具栏 |
| 删除 | `components/data-stream-handler.tsx` | 处理 artifact 流数据（data-id、data-title 等） |
| 修改 | `components/chat.tsx` 的 `onData` | 将 `data-chat-title` 的 mutate 逻辑从 DataStreamHandler 迁移到此 |
| 修改 | `components/chat.tsx` | 移除 `<Artifact>`、`useArtifactSelector`、`isArtifactVisible` |
| 修改 | `components/messages.tsx` | 移除 artifact 相关 props |
| 修改 | `components/message.tsx` | 移除 `DocumentToolResult`、`DocumentPreview`、`request-suggestions` 工具展示；移除 create/update document 相关 UI |
| 修改 | `components/multimodal-input.tsx` | 移除 artifact 相关（若仅 artifact 使用则保留基础输入） |
| 修改 | `hooks/use-artifact.ts` | 删除整个 hook，并移除所有引用 |

#### Artifacts 模块

| 操作 | 路径 |
|------|------|
| 删除 | `artifacts/text/client.tsx` |
| 删除 | `artifacts/text/server.ts` |
| 删除 | `artifacts/code/client.tsx` |
| 删除 | `artifacts/code/server.ts` |
| 删除 | `artifacts/image/client.tsx` |
| 删除 | `artifacts/sheet/client.tsx` |
| 删除 | `artifacts/sheet/server.ts` |
| 删除 | `lib/artifacts/server.ts` |
| 删除 | `artifacts/actions.ts` |

#### 编辑器 / Suggestion（仅 artifact 使用）

| 操作 | 路径 |
|------|------|
| 删除 | `lib/editor/suggestions.tsx` |
| 删除 | `components/suggestion.tsx`（若仅 document 用） |
| 删除 | `components/text-editor.tsx`（若仅 artifact 用） |
| 删除 | `components/code-editor.tsx`（若仅 artifact 用） |
| 删除 | `components/sheet-editor.tsx` |
| 删除 | `components/diffview.tsx`（若仅 artifact 用） |
| 修改 | `lib/editor/config.ts`、`lib/editor/functions.tsx` 等 | 移除 suggestion 相关，或删除整个 editor 模块 |

> ⚠️ `text-editor`、`code-editor` 等可能被多处引用，需逐个确认后再删。

#### DB

| 操作 | 表 | 说明 |
|------|-----|------|
| 删除 | `document` | 新建 migration 删除 Document 表 |
| 删除 | `suggestion` | 新建 migration 删除 Suggestion 表（依赖 document） |

#### 其它

| 操作 | 路径 |
|------|------|
| 修改 | `lib/db/schema.ts` | 移除 `document`、`suggestion` 表定义 |
| 修改 | `lib/db/queries.ts` | 移除 `saveDocument`、`getDocumentsById`、`deleteDocumentsByIdAfterTimestamp`、`saveSuggestions`、`getSuggestionsByDocumentId` 及 document/suggestion 相关删除逻辑 |
| 修改 | `lib/types.ts` | 移除 Artifact 相关类型（若有） |
| 修改 | `lib/errors.ts` | 移除 `document`、`suggestions` 相关错误码（可选） |

### 3.2 Layout / Provider 调整

| 操作 | 路径 | 修改内容 |
|------|------|----------|
| 修改 | `app/(chat)/layout.tsx` | 移除 `DataStreamProvider`；从 page.tsx 移除 `DataStreamHandler` |
| 修改 | `app/(chat)/page.tsx` | 移除 `DataStreamHandler` |
| 修改 | `app/(chat)/chat/[id]/page.tsx` | 移除 `DataStreamHandler` |
| 修改 | `components/chat.tsx` | 在 `onData` 中处理 `data-chat-title`，调用 `mutate(getChatHistoryPaginationKey)` 刷新历史；移除 `useDataStream`、`setDataStream` |
| 修改/删除 | `components/data-stream-provider.tsx` | DataStreamHandler 删除后，若仅其使用 `useDataStream`，可删除 Provider；否则保留简化版 |

**data-chat-title 迁移**：`data-chat-title` 由 chat route 在生成标题时写入流，原由 DataStreamHandler 消费并 mutate 历史。删除 DataStreamHandler 后，在 `chat.tsx` 的 `useChat` 的 `onData` 中判断 `delta.type === "data-chat-title"` 时调用 `mutate(unstable_serialize(getChatHistoryPaginationKey))` 即可。

**text-editor / code-editor / sheet-editor**：仅被 `artifacts/*/client.tsx` 引用，删除 artifacts 后可一并删除。

### 3.3 依赖清理

- 检查 `package.json`：移除仅 artifact 使用的依赖（如 `@tiptap/*`、`prosemirror-*` 等）
- 移除 Pyodide Script（`app/(chat)/layout.tsx`）若仅用于 code artifact 执行

---

## 执行顺序建议

1. **阶段一：Neo4j**
   - 删除 test-neo4j、neo4j.ts、neo4j-tools.ts
   - 更新 package.json、.env.example

2. **阶段二：Auth**
   - 创建匿名用户 seed/migration
   - 修改所有 API 使用匿名 userId
   - 修改 proxy、layout、chat page
   - 删除 auth 相关路由、页面、组件

3. **阶段三：Document/Artifact**
   - 从 chat route 移除 document 相关 tools
   - 修改 prompts
   - 删除 document、suggestions API
   - 删除 artifact 组件及 artifacts 模块
   - 新建 migration 删除 document、suggestion 表
   - 修改 schema、queries、类型定义
   - 精简 layout、chat、messages、message 等组件

---

## Task 清单（可勾选跟踪）

### 任务一：Neo4j
- [ ] 1.1 删除 `app/api/test-neo4j/route.ts`
- [ ] 1.2 删除 `lib/db/neo4j.ts`
- [ ] 1.3 删除 `lib/ai/tools/neo4j-tools.ts`
- [ ] 1.4 修改 `package.json` 移除 neo4j-driver
- [ ] 1.5 修改 `.env.example` 移除 Neo4j 配置说明
- [ ] 1.6 运行 `pnpm install`

### 任务二：Auth（方案 B）
- [ ] 2.A1 新建 `lib/anonymous-user.ts`（getAnonymousUserId）
- [ ] 2.B1 修改 `api/chat/route.ts` 使用 getAnonymousUserId
- [ ] 2.B2 修改 `api/history/route.ts` 使用 getAnonymousUserId
- [ ] 2.B3 修改 `api/vote/route.ts` 使用 getAnonymousUserId
- [ ] 2.B4 修改 `api/files/upload/route.ts` 使用 getAnonymousUserId
- [ ] 2.C1 修改 `proxy.ts` 直接放行，移除 token/guest 重定向
- [ ] 2.D1 修改 `chat/[id]/page.tsx` 使用 getAnonymousUserId，保留 isReadonly/visibility 校验
- [ ] 2.D2 修改 `app/(chat)/layout.tsx` 移除 auth，传占位 user
- [ ] 2.D3 修改 `app/layout.tsx` 移除 SessionProvider
- [ ] 2.E1 简化 `sidebar-user-nav.tsx`（仅保留主题切换）
- [ ] 2.E2 修改 `app-sidebar.tsx` 适配占位 user
- [ ] 2.E3 修改 `sidebar-history.tsx` 适配占位 user（显示历史）
- [ ] 2.F1 修改 `lib/ai/entitlements.ts` 简化为单一限制
- [ ] 2.F2 修改 `lib/constants.ts` 移除 guestRegex、DUMMY_PASSWORD
- [ ] 2.G1–G9 删除 auth 路由、login/register 页面、auth-form、sign-out-form
- [ ] 2.H1 移除 next-auth、bcrypt-ts 依赖

### 任务三：Document/Artifact
- [ ] 3.1 从 `app/(chat)/api/chat/route.ts` 移除 createDocument、updateDocument、requestSuggestions
- [ ] 3.2 修改 `lib/ai/prompts.ts` 移除 artifactsPrompt 及相关
- [ ] 3.3 删除 `app/(chat)/api/document`、`app/(chat)/api/suggestions`
- [ ] 3.4 删除 create-document、update-document、request-suggestions tools
- [ ] 3.5 删除 artifact 相关组件（artifact、artifact-actions、version-footer 等）
- [ ] 3.6 删除 artifacts 模块（text/code/image/sheet）
- [ ] 3.7 修改 message.tsx 移除 DocumentToolResult、DocumentPreview、request-suggestions UI
- [ ] 3.8 修改 chat.tsx：移除 Artifact、迁移 data-chat-title 到 onData
- [ ] 3.9 删除 DataStreamHandler，按需简化 DataStreamProvider
- [ ] 3.10 删除 text-editor、code-editor、sheet-editor、document 等组件
- [ ] 3.11 新建 migration 删除 document、suggestion 表
- [ ] 3.12 修改 lib/db/schema.ts、queries.ts

---

## 执行前检查清单

- [ ] 确认 proxy 是否被 middleware 使用（当前项目中未发现 middleware.ts）
- [ ] 备份数据库，测试环境先执行 migrations
- [ ] 每阶段完成后运行 `pnpm run build`、`pnpm run lint`
