import { cookies } from "next/headers";
import Script from "next/script";
import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatLayoutClient } from "@/components/chat-layout-client";
import { DataStreamProvider } from "@/components/data-stream-provider";
import { HeaderSlotRenderer } from "@/components/header-slot-context";
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
          className="relative flex h-dvh w-full flex-col overflow-x-hidden overflow-y-hidden"
          style={{ "--header-height": "3.5rem" } as React.CSSProperties}
        >
          {/* Header positioned above everything */}
          <div
            className="absolute inset-x-0 top-0 z-20"
            style={{ height: "var(--header-height)" }}
          >
            <HeaderSlotRenderer />
          </div>

          {/* Sidebar and main content below header */}
          <div
            className="flex min-h-0 flex-1"
            style={{ paddingTop: "var(--header-height)" }}
          >
            <AppSidebar user={session?.user} />
            <SidebarInset>{children}</SidebarInset>
          </div>
        </div>
      </ChatLayoutClient>
    </SidebarProvider>
  );
}
