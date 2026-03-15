/**
 * Extract PageIndex document sources from get_page_content tool calls.
 * Supports both success and error outputs; uses input as fallback when output lacks data.
 */
import type { ChatMessage } from "@/lib/types";

export type PageIndexSource = {
  docName: string;
  pages: number[];
};

/**
 * Parse pages string like "1-3" or "1,5,7" into number array.
 */
function parsePagesString(pagesStr: string | undefined): number[] {
  if (!pagesStr || typeof pagesStr !== "string") return [];
  const trimmed = pagesStr.trim();
  if (!trimmed) return [];

  const result: number[] = [];
  for (const part of trimmed.split(",")) {
    const range = part.trim();
    if (range.includes("-")) {
      const [start, end] = range.split("-").map((s) => parseInt(s.trim(), 10));
      if (!Number.isNaN(start) && !Number.isNaN(end)) {
        for (let i = start; i <= end; i++) {
          result.push(i);
        }
      }
    } else {
      const n = parseInt(range, 10);
      if (!Number.isNaN(n)) result.push(n);
    }
  }
  return [...new Set(result)].sort((a, b) => a - b);
}

/**
 * Extract doc_name and pages from get_page_content tool output.
 * Output structure: { content: [{ type: "text", text: "<inner JSON>" }], isError }
 * Inner JSON: { success, doc_name, content: [{ page, text }], ... } or { error, doc_name, ... }
 */
function parseGetPageContentOutput(output: unknown): PageIndexSource | null {
  if (output == null || typeof output !== "object") return null;

  const obj = output as Record<string, unknown>;
  // If the outer wrapper already marks this as an error, skip it entirely.
  if (obj.isError === true) return null;
  const contentArr = obj.content;
  if (!Array.isArray(contentArr) || contentArr.length === 0) return null;

  const firstContent = contentArr[0] as { type?: string; text?: string };
  const text = firstContent?.text;
  if (typeof text !== "string") return null;

  let inner: Record<string, unknown>;
  try {
    inner = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }

  // Skip inner error payloads as sources (they usually have meaningless doc_name like ":" or empty pages).
  if (inner.error || inner.isError === true || inner.success === false) {
    return null;
  }

  const docName = inner.doc_name;
  if (typeof docName !== "string" || !docName.trim()) return null;

  let pages: number[] = [];

  const innerContent = inner.content;
  if (Array.isArray(innerContent)) {
    const pageNums = innerContent
      .map((item) => {
        const p = typeof item === "object" && item && "page" in item ? item.page : null;
        return typeof p === "number" && !Number.isNaN(p) ? p : null;
      })
      .filter((p): p is number => p !== null);
    if (pageNums.length > 0) {
      pages = [...new Set(pageNums)].sort((a, b) => a - b);
    }
  }

  if (pages.length === 0 && typeof inner.returned_pages === "string") {
    pages = parsePagesString(inner.returned_pages);
  }
  if (pages.length === 0 && typeof inner.requested_pages === "string") {
    pages = parsePagesString(inner.requested_pages);
  }

  return { docName: docName.trim(), pages };
}

/**
 * Extract doc_name and pages from get_page_content tool input.
 * Input: { doc_name: string, pages?: string }
 */
function parseGetPageContentInput(input: unknown): PageIndexSource | null {
  if (input == null || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  const docName = obj.doc_name;
  if (typeof docName !== "string" || !docName.trim()) return null;

  const pagesStr = obj.pages;
  const pages =
    typeof pagesStr === "string"
      ? parsePagesString(pagesStr)
      : [];

  return { docName: docName.trim(), pages };
}

/**
 * Best-effort detection of error payloads, even when output is a raw JSON string.
 */
function isErrorLikeOutput(output: unknown): boolean {
  if (output == null) return false;

  if (typeof output === "string") {
    const lower = output.toLowerCase();
    return lower.includes('"iserror": true') || lower.includes("'isError': true".toLowerCase());
  }

  if (typeof output === "object") {
    const obj = output as Record<string, unknown>;
    if (obj.isError === true) return true;

    const contentArr = obj.content;
    if (Array.isArray(contentArr)) {
      for (const item of contentArr) {
        const maybeText =
          item && typeof item === "object" && "text" in item
            ? (item as { text?: unknown }).text
            : undefined;
        if (typeof maybeText === "string") {
          const lower = maybeText.toLowerCase();
          if (
            lower.includes('"iserror": true') ||
            lower.includes("'isError': true".toLowerCase())
          ) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Deduplicate sources by docName, merging pages.
 */
function deduplicateSources(sources: PageIndexSource[]): PageIndexSource[] {
  const byName = new Map<string, Set<number>>();
  for (const s of sources) {
    const existing = byName.get(s.docName);
    if (existing) {
      for (const p of s.pages) existing.add(p);
    } else {
      byName.set(s.docName, new Set(s.pages));
    }
  }
  return Array.from(byName.entries()).map(([docName, pageSet]) => ({
    docName,
    pages: [...pageSet].sort((a, b) => a - b),
  }));
}

/**
 * Extract all PageIndex sources from assistant message parts (get_page_content tool calls).
 * Order follows tool invocation order.
 */
export function extractPageIndexSources(message: ChatMessage): PageIndexSource[] {
  if (message.role !== "assistant" || !message.parts) return [];

  const sources: PageIndexSource[] = [];

  for (const part of message.parts) {
    if (part == null || part.type !== "dynamic-tool") continue;

    const dynamicPart = part as {
      toolName?: string;
      input?: unknown;
      output?: unknown;
      state?: string;
    };

    const toolName = dynamicPart.toolName;
    if (toolName !== "get_page_content" && toolName !== "get_content") {
      continue;
    }

    // Only treat successful outputs as citation sources, and skip any payloads
    // that look like explicit error responses (including isError: true inside
    // the JSON string).
    if (dynamicPart.state !== "output-available") {
      continue;
    }
    if (isErrorLikeOutput(dynamicPart.output)) {
      continue;
    }

    let source: PageIndexSource | null = parseGetPageContentOutput(dynamicPart.output);
    if (!source) {
      source = parseGetPageContentInput(dynamicPart.input);
    }
    if (source) {
      sources.push(source);
    }
  }

  return deduplicateSources(sources);
}
