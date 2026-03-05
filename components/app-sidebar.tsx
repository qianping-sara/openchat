"use client";

import type { User } from "next-auth";
import {
  Sidebar,
  SidebarContent,
} from "@/components/ui/sidebar";
import { SidebarHistory } from "@/components/sidebar-history";

export function AppSidebar({ user }: { user: User | undefined }) {
  return (
    <Sidebar className="group-data-[side=left]:border-r-0">
      <SidebarContent>
        <SidebarHistory user={user} />
      </SidebarContent>
    </Sidebar>
  );
}
