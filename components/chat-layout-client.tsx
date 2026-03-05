"use client";

import { HeaderSlotProvider } from "@/components/header-slot-context";

export function ChatLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return <HeaderSlotProvider>{children}</HeaderSlotProvider>;
}
