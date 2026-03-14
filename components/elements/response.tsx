"use client";

import type { ComponentProps } from "react";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";

type ResponseProps = ComponentProps<typeof Streamdown>;

export function Response({ className, children, ...props }: ResponseProps) {
  return (
    <Streamdown
      className={cn(
        [
          // 宽度&基础排版
          "min-w-0 size-full whitespace-normal break-words",
          "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
          // 代码&预格式文本（允许横向滚动，不要撑爆视口）
          "[&_code]:whitespace-pre-wrap [&_code]:break-words",
          "[&_pre]:max-w-full [&_pre]:overflow-x-auto",
          // 表格在移动端不要固定宽度，强制不超过视口
          "[&_table]:w-full [&&_table]:max-w-full [&_table]:table-fixed",
          "[&_th]:whitespace-normal [&_th]:break-words",
          "[&_td]:whitespace-normal [&_td]:break-words",
        ].join(" "),
        className
      )}
      {...props}
    >
      {children}
    </Streamdown>
  );
}
