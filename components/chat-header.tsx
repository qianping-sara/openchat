"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import ascentiumIcon from "@/assets/ascentium-icon.png";
import { memo, useEffect, useMemo } from "react";
import { useHeaderSlot } from "@/components/header-slot-context";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { Button } from "@/components/ui/button";
import { HeaderUserNav } from "@/components/header-user-nav";
import { PlusIcon } from "./icons";
import type { VisibilityType } from "./visibility-selector";

function PureChatHeader({
  chatId,
  selectedVisibilityType,
  isReadonly,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const router = useRouter();
  const headerSlot = useHeaderSlot();

  const headerContent = useMemo(
    () => (
    <header className="sticky top-0 z-10 flex shrink-0 items-center gap-2 bg-background px-2 py-1.5 md:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg"
          aria-hidden
        >
          <Image
            alt=""
            className="object-contain"
            height={40}
            priority
            src={ascentiumIcon}
            width={40}
          />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-[#E85D04]">
            ASCENTIUM
          </span>
          <span className="truncate text-xs text-zinc-900 dark:text-zinc-200">
            ODI China Knowledge AI
          </span>
        </div>
      </div>

      <SidebarToggle />

      <Button
        className="size-8 shrink-0 p-0 md:size-8 md:p-0"
        onClick={() => {
          router.push("/");
          router.refresh();
        }}
        variant="outline"
      >
        <PlusIcon />
        <span className="sr-only">New Chat</span>
      </Button>

      <HeaderUserNav
        chatId={chatId}
        isReadonly={isReadonly}
        selectedVisibilityType={selectedVisibilityType}
      />
    </header>
    ),
    [chatId, selectedVisibilityType, isReadonly]
  );

  useEffect(() => {
    headerSlot?.setHeaderContent(headerContent);
    return () => {
      headerSlot?.setHeaderContent(null);
    };
  }, [headerSlot, headerContent]);

  if (!headerSlot) {
    return headerContent;
  }

  return null;
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.isReadonly === nextProps.isReadonly
  );
});
