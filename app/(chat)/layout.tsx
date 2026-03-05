import { cookies } from "next/headers";
import Script from "next/script";
import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatLayoutClient } from "@/components/chat-layout-client";
import { HeaderSlotRenderer } from "@/components/header-slot-context";
import { DataStreamProvider } from "@/components/data-stream-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth } from "../(auth)/auth";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="beforeInteractive"
      />
      <DataStreamProvider>
        <Suspense fallback={<div className="flex h-dvh" />}>
          <SidebarWrapper>{children}</SidebarWrapper>
        </Suspense>
      </DataStreamProvider>
    </>
  );
}

async function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  const isCollapsed = cookieStore.get("sidebar_state")?.value !== "true";

  return (
    <SidebarProvider defaultOpen={!isCollapsed}>
      <ChatLayoutClient>
        <div
          className="flex h-dvh w-full flex-col overflow-x-hidden overflow-y-hidden"
          style={{ "--header-height": "3.5rem" } as React.CSSProperties}
        >
          <div
            className="shrink-0 border-b bg-background"
            style={{ height: "var(--header-height)" }}
          >
            <HeaderSlotRenderer />
          </div>
          <div className="flex min-h-0 flex-1">
            <AppSidebar user={session?.user} />
            <SidebarInset>{children}</SidebarInset>
          </div>
        </div>
      </ChatLayoutClient>
    </SidebarProvider>
  );
}
