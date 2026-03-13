"use client";

import type { ToolUIPart } from "ai";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  CircleIcon,
  ClockIcon,
  XCircleIcon,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export type ToolProps = ComponentProps<typeof Collapsible>;

export const Tool = ({ className, ...props }: ToolProps) => (
  <Collapsible
    className={cn("group not-prose mb-0 w-full", className)}
    {...props}
  />
);

export type ToolHeaderProps = {
  type: ToolUIPart["type"];
  state: ToolUIPart["state"];
  className?: string;
};

const getStatusLabel = (status: ToolUIPart["state"]) => {
  const labels: Record<ToolUIPart["state"], string> = {
    "input-streaming": "Pending",
    "input-available": "Running",
    "approval-requested": "Pending",
    "approval-responded": "Approved",
    "output-available": "Completed",
    "output-error": "Error",
    "output-denied": "Denied",
  };
  return labels[status];
};

const getStatusIcon = (status: ToolUIPart["state"]) => {
  const icons: Record<ToolUIPart["state"], ReactNode> = {
    "input-streaming": <CircleIcon className="size-3" />,
    "input-available": <ClockIcon className="size-3 animate-pulse" />,
    "approval-requested": <ClockIcon className="size-3 text-yellow-600" />,
    "approval-responded": (
      <CheckCircleIcon className="size-3 text-[#E85D04]" />
    ),
    "output-available": (
      <CheckCircleIcon className="size-3 text-[#E85D04]" />
    ),
    "output-error": <XCircleIcon className="size-3 text-red-600" />,
    "output-denied": <XCircleIcon className="size-3 text-orange-600" />,
  };
  return icons[status];
};

/** Human-readable label for tool type (e.g. "tool-sequential_thinking" → "Sequential thinking") */
function getToolDisplayName(toolType: string): string {
  const name = toolType.startsWith("tool-")
    ? toolType.slice(5).replace(/_/g, " ")
    : toolType;
  return name.length > 0 ? name.charAt(0).toUpperCase() + name.slice(1) : name;
}

export const ToolHeader = ({
  className,
  type,
  state,
  ...props
}: ToolHeaderProps) => (
  <CollapsibleTrigger
    className={cn(
      "flex w-full min-w-0 items-center gap-0.5 rounded-md px-0.5 py-0 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
      className
    )}
    {...props}
  >
    <span className="flex shrink-0 items-center gap-1">
      {getStatusIcon(state)}
    </span>
    <span className="min-w-0 flex items-center gap-0.5 truncate text-left">
      <span className="truncate">{getToolDisplayName(type)}</span>
      <ChevronDownIcon
        className={cn(
          "size-2.5 shrink-0 transition-transform",
          "group-data-[state=open]:rotate-180"
        )}
      />
    </span>
  </CollapsibleTrigger>
);

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolContent = ({
  className,
  children,
  ...props
}: ToolContentProps) => (
  <CollapsibleContent
    className={cn(
      "mt-1 text-[11px] text-muted-foreground leading-relaxed",
      "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 outline-hidden data-[state=closed]:animate-out data-[state=open]:animate-in",
      className
    )}
    {...props}
  >
    <div className="max-h-[50vh] overflow-y-auto rounded-md border border-border/50 bg-muted/30 p-2.5">
      {children}
    </div>
  </CollapsibleContent>
);

export type ToolInputProps = ComponentProps<"div"> & {
  input: ToolUIPart["input"];
};

export const ToolInput = ({ className, input, ...props }: ToolInputProps) => (
  <div className={cn("space-y-2 overflow-hidden p-2", className)} {...props}>
    <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
      Parameters
    </h4>
    <pre className="overflow-x-auto rounded-md bg-muted/50 p-3 font-mono text-xs">
      {JSON.stringify(input, null, 2)}
    </pre>
  </div>
);

export type ToolOutputProps = ComponentProps<"div"> & {
  output: ReactNode;
  errorText: ToolUIPart["errorText"];
};

export const ToolOutput = ({
  className,
  output,
  errorText,
  ...props
}: ToolOutputProps) => {
  if (!(output || errorText)) {
    return null;
  }

  return (
    <div className={cn("space-y-2 p-2", className)} {...props}>
      <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {errorText ? "Error" : "Result"}
      </h4>
      <div
        className={cn(
          "overflow-x-auto rounded-md text-xs [&_table]:w-full",
          errorText
            ? "bg-destructive/10 text-destructive"
            : "bg-muted/50 text-foreground"
        )}
      >
        {errorText && <div>{errorText}</div>}
        {output && <div>{output}</div>}
      </div>
    </div>
  );
};
