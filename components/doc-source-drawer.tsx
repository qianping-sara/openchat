"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useMediaQuery } from "usehooks-ts";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DocPreview } from "@/components/doc-preview";
import { Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

type DrawerState = {
  docName: string;
  initialPage?: number;
  docId: string | null;
  resolveStatus: "idle" | "loading" | "success" | "error";
  errorMessage?: string;
};

type DocSourceDrawerContextValue = {
  open: (docName: string, initialPage?: number) => void;
};

const DocSourceDrawerContext = createContext<
  DocSourceDrawerContextValue | undefined
>(undefined);

export function useDocSourceDrawer(): DocSourceDrawerContextValue {
  const ctx = useContext(DocSourceDrawerContext);
  if (!ctx) {
    return {
      open: () => {
        // No-op when used outside provider; avoids throwing
      },
    };
  }
  return ctx;
}

export function DocSourceDrawerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<DrawerState>({
    docName: "",
    docId: null,
    resolveStatus: "idle",
  });

  const isMdOrUp = useMediaQuery("(min-width: 768px)");

  const openDrawer = useCallback(
    async (docName: string, initialPage?: number) => {
      setState({
        docName,
        initialPage,
        docId: null,
        resolveStatus: "loading",
      });
      setOpen(true);

      try {
        const params = new URLSearchParams();
        params.set("name", docName);
        const res = await fetch(`/api/doc/resolve?${params.toString()}`);
        const json = (await res.json()) as { docId?: string; docName?: string };

        if (!res.ok) {
          setState((s) => ({
            ...s,
            resolveStatus: "error",
            errorMessage:
              (json as { message?: string }).message ?? "无法解析文档",
          }));
          return;
        }

        const docId = json.docId;
        if (!docId) {
          setState((s) => ({
            ...s,
            resolveStatus: "error",
            errorMessage: "未找到文档",
          }));
          return;
        }

        setState({
          docName: json.docName ?? docName,
          initialPage,
          docId,
          resolveStatus: "success",
        });
      } catch {
        setState((s) => ({
          ...s,
          resolveStatus: "error",
          errorMessage: "加载失败",
        }));
      }
    },
    []
  );

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setState({
        docName: "",
        docId: null,
        resolveStatus: "idle",
      });
    }
  }, []);

  const value = useMemo(
    () => ({
      open: openDrawer,
    }),
    [openDrawer]
  );

  return (
    <DocSourceDrawerContext.Provider value={value}>
      {children}
      <Sheet onOpenChange={onOpenChange} open={open}>
        <SheetContent
          side={isMdOrUp ? "right" : "bottom"}
          className={cn(
            "flex flex-col gap-0 overflow-hidden p-0",
            isMdOrUp
              ? "h-full w-1/2 sm:max-w-none"
              : "inset-x-0 w-full max-h-[90vh] rounded-t-xl"
          )}
        >
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-auto overscroll-contain">
            <SheetHeader
              className="sticky top-0 z-10 shrink-0 border-b border-border/40 px-6 py-4"
              style={{
                background:
                  "linear-gradient(to bottom, color-mix(in oklch, var(--background) 70%, transparent), color-mix(in oklch, var(--background) 40%, transparent))",
              }}
            >
              <SheetTitle className="truncate text-base">
                {state.docName ? `《${state.docName}》` : "参考文档"}
              </SheetTitle>
            </SheetHeader>
            <div className="px-2">
              {state.resolveStatus === "loading" && (
                <div
                  className="flex flex-col items-center justify-center gap-3 py-16"
                  role="status"
                  aria-label="加载中"
                >
                  <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">
                    正在加载文档…
                  </p>
                </div>
              )}
              {state.resolveStatus === "error" && (
                <div
                  className="flex flex-col items-center justify-center gap-3 py-16"
                  role="alert"
                >
                  <p className="text-destructive text-sm">
                    {state.errorMessage ?? "加载失败"}
                  </p>
                </div>
              )}
              {state.resolveStatus === "success" && state.docId && (
                <DocPreview
                  docId={state.docId}
                  initialPage={state.initialPage}
                />
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </DocSourceDrawerContext.Provider>
  );
}
