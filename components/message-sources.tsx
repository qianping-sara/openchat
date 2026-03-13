"use client";

import { FileTextIcon } from "lucide-react";
import type { PageIndexSource } from "@/lib/citations/sources";
import { useDocSourceDrawer } from "@/components/doc-source-drawer";
import { cn } from "@/lib/utils";

type PageBlock = { display: string; firstPage: number };

/**
 * Group sorted page numbers into blocks. Consecutive pages become a range (e.g. 37-38),
 * single pages stay as one block. Each block is clickable and jumps to its first page.
 */
function groupPagesIntoBlocks(pages: number[]): PageBlock[] {
  if (pages.length === 0) return [];
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const blocks: PageBlock[] = [];
  let start = sorted[0];
  let end = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      blocks.push({
        display: start === end ? String(start) : `${start}-${end}`,
        firstPage: start,
      });
      start = sorted[i];
      end = sorted[i];
    }
  }
  blocks.push({
    display: start === end ? String(start) : `${start}-${end}`,
    firstPage: start,
  });
  return blocks;
}

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
          const pageBlocks = groupPagesIntoBlocks(source.pages);
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
              {pageBlocks.length > 0 && (
                <span className="text-muted-foreground text-xs">
                  第{" "}
                  {pageBlocks.map((block, blockIndex) => (
                    <span key={`${source.docName}-${index}-${blockIndex}`}>
                      {blockIndex > 0 && "、"}
                      <button
                        type="button"
                        onClick={() =>
                          open(source.docName, block.firstPage)
                        }
                        className="underline-offset-4 hover:underline"
                        title={`跳转到第 ${block.display} 页`}
                      >
                        {block.display}
                      </button>
                    </span>
                  ))}{" "}
                  页
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
