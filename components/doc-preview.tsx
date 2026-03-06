"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileTextIcon, Loader2Icon } from "lucide-react";
import { Response } from "@/components/elements/response";
import { cn } from "@/lib/utils";

type PageItem = {
  page_index?: number;
  page?: number;
  markdown?: string;
  text?: string;
  images?: string[];
};

type DocContentResponse = {
  result?: PageItem[];
  content?: PageItem[];
  doc_id?: string;
  status?: string;
};

function extractPages(data: DocContentResponse): PageItem[] {
  const result = data.result ?? data.content;
  if (Array.isArray(result)) return result;
  return [];
}

function getPageIndex(item: PageItem): number {
  const idx = item.page_index ?? item.page;
  return typeof idx === "number" && !Number.isNaN(idx) ? idx : 0;
}

function getPageText(item: PageItem): string {
  return item.markdown ?? item.text ?? "";
}

export function DocPreview({
  docId,
  initialPage: initialPageProp,
}: {
  docId: string;
  initialPage?: number;
}) {
  const searchParams = useSearchParams();
  const pageParam = searchParams.get("page");
  const pageFromUrl =
    pageParam != null ? parseInt(pageParam, 10) : Number.NaN;
  const initialPage =
    initialPageProp ??
    (Number.isNaN(pageFromUrl) || pageFromUrl < 1 ? undefined : pageFromUrl);

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [data, setData] = useState<DocContentResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    const fetchContent = async () => {
      try {
        const res = await fetch(`/api/doc/${encodeURIComponent(docId)}/content`);
        if (cancelled) return;

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setErrorMessage(err.message ?? err.cause ?? "加载失败");
          setStatus("error");
          return;
        }

        const json = (await res.json()) as DocContentResponse;
        setData(json);
        setStatus("success");
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : "加载失败");
        setStatus("error");
      }
    };

    fetchContent();
    return () => {
      cancelled = true;
    };
  }, [docId]);

  useEffect(() => {
    if (status !== "success" || !data) return;
    const pageNum = initialPage ?? (pageParam ? parseInt(pageParam, 10) : Number.NaN);
    if (Number.isNaN(pageNum) || pageNum < 1) return;

    const el = document.getElementById(`page-${pageNum}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [status, data, initialPage, pageParam]);

  if (status === "loading") {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 py-16"
        role="status"
        aria-label="加载中"
      >
        <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground text-sm">正在加载文档…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 py-16"
        role="alert"
      >
        <FileTextIcon className="size-12 text-muted-foreground" />
        <p className="text-destructive text-sm">{errorMessage}</p>
      </div>
    );
  }

  const pages = extractPages(data ?? {});
  if (pages.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 py-16"
        role="status"
      >
        <FileTextIcon className="size-12 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">文档暂无内容</p>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-12 px-4 py-8">
      {pages.map((item) => {
        const idx = getPageIndex(item);
        const text = getPageText(item);
        const id = `page-${idx}`;

        return (
          <section
            key={id}
            id={id}
            className={cn(
              "min-w-0 overflow-x-auto rounded-lg border border-border bg-background p-6",
              "prose prose-neutral dark:prose-invert max-w-none break-words wrap-anywhere"
            )}
          >
            <div className="mb-2 text-muted-foreground text-xs font-medium">
              第 {idx} 页
            </div>
            <Response className="text-foreground text-sm leading-relaxed [&_pre]:overflow-x-auto">
              {text}
            </Response>
          </section>
        );
      })}
    </div>
  );
}
