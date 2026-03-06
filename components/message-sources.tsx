"use client";

import { FileTextIcon } from "lucide-react";
import type { PageIndexSource } from "@/lib/citations/sources";
import { useDocSourceDrawer } from "@/components/doc-source-drawer";
import { cn } from "@/lib/utils";

export function MessageSources({
  sources,
  className,
}: {
  sources: PageIndexSource[];
  className?: string;
}) {
  const { open } = useDocSourceDrawer();

  if (sources.length === 0) return null;

  return (
    <div
      className={cn(
        "mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2",
        className
      )}
      role="region"
      aria-label="参考来源"
    >
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
        <FileTextIcon className="size-3.5" aria-hidden />
        <span>参考来源</span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {sources.map((source, index) => {
          const firstPage = source.pages.at(0);
          return (
            <li
              key={`${source.docName}-${index}`}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm"
            >
              <button
                type="button"
                onClick={() => open(source.docName, firstPage)}
                className="font-medium text-foreground underline-offset-4 hover:underline text-left"
                title={`查看《${source.docName}》`}
              >
                《{source.docName}》
              </button>
              {source.pages.length > 0 && (
                <span className="text-muted-foreground text-xs">
                  第 {source.pages.join("、")} 页
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
