"use client";

import { LogIn, LogOut, Moon, Sun } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { useLocale } from "@/components/locale-provider";
import { getChatHistoryPaginationKey } from "@/components/sidebar-history";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import { guestRegex } from "@/lib/constants";
import { CheckCircleFillIcon, GlobeIcon, LockIcon, TrashIcon } from "./icons";
import type { VisibilityType } from "./visibility-selector";

type HeaderUserNavProps = {
  chatId: string;
  isReadonly: boolean;
  selectedVisibilityType: VisibilityType;
};

export function HeaderUserNav({
  chatId,
  isReadonly,
  selectedVisibilityType,
}: HeaderUserNavProps) {
  const router = useRouter();
  const { data, status } = useSession();
  const { setTheme, resolvedTheme } = useTheme();
  const { mutate } = useSWRConfig();
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const { locale, setLocale } = useLocale();

  const { visibilityType, setVisibilityType } = useChatVisibility({
    chatId,
    initialVisibilityType: selectedVisibilityType,
  });

  const user = data?.user;
  const isGuest = user?.email ? guestRegex.test(user.email) : false;

  const handleDeleteAll = () => {
    const deletePromise = fetch("/api/history", { method: "DELETE" });

    toast.promise(deletePromise, {
      loading: "Deleting all chats...",
      success: () => {
        mutate(unstable_serialize(getChatHistoryPaginationKey));
        setShowDeleteAllDialog(false);
        router.replace("/");
        router.refresh();
        return "All chats deleted successfully";
      },
      error: "Failed to delete all chats",
    });
  };

  if (status === "loading" || !user) {
    return (
      <Button
        className="size-8 shrink-0 rounded-full p-0"
        disabled
        type="button"
        variant="ghost"
      >
        <div className="size-8 animate-pulse rounded-full bg-muted" />
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className="size-8 shrink-0 overflow-hidden rounded-full p-0 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            data-testid="header-user-nav-button"
            type="button"
            variant="ghost"
          >
            <Image
              alt={user.email ?? "User Avatar"}
              className="rounded-full"
              height={32}
              src={`https://avatar.vercel.sh/${user.email}`}
              width={32}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56"
          data-testid="header-user-nav-menu"
          side="bottom"
        >
          {/* 1. Login / Sign out */}
          <DropdownMenuItem asChild data-testid="header-user-nav-item-auth">
            <button
              className="flex w-full cursor-pointer items-center gap-2"
              onClick={() => {
                if (isGuest) {
                  router.push("/login");
                } else {
                  signOut({ redirectTo: "/" });
                }
              }}
              type="button"
            >
              {isGuest ? <LogIn size={16} /> : <LogOut size={16} />}
              {isGuest ? "Login to your account" : "Sign out"}
            </button>
          </DropdownMenuItem>

          {/* 2. Language */}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Language</DropdownMenuLabel>
          <DropdownMenuItem
            className="group/item flex cursor-pointer items-center justify-between"
            data-active={locale === "zh"}
            data-testid="locale-selector-item-zh"
            onSelect={() => setLocale("zh")}
          >
            <span className="flex items-center gap-2">中文</span>
            {locale === "zh" && (
              <span className="text-foreground opacity-100">
                <CheckCircleFillIcon />
              </span>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="group/item flex cursor-pointer items-center justify-between"
            data-active={locale === "en"}
            data-testid="locale-selector-item-en"
            onSelect={() => setLocale("en")}
          >
            <span className="flex items-center gap-2">English</span>
            {locale === "en" && (
              <span className="text-foreground opacity-100">
                <CheckCircleFillIcon />
              </span>
            )}
          </DropdownMenuItem>

          {/* 3. Chat visibility */}
          {!isReadonly && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-muted-foreground text-xs font-medium">
                Chat visibility
              </div>
              <DropdownMenuItem
                className="group/item flex cursor-pointer items-center justify-between"
                data-active={visibilityType === "private"}
                data-testid="visibility-selector-item-private"
                onSelect={() => setVisibilityType("private")}
              >
                <span className="flex items-center gap-2">
                  <LockIcon />
                  Private
                </span>
                {visibilityType === "private" && (
                  <span className="text-foreground opacity-100">
                    <CheckCircleFillIcon />
                  </span>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="group/item flex cursor-pointer items-center justify-between"
                data-active={visibilityType === "public"}
                data-testid="visibility-selector-item-public"
                onSelect={() => setVisibilityType("public")}
              >
                <span className="flex items-center gap-2">
                  <GlobeIcon />
                  Public
                </span>
                {visibilityType === "public" && (
                  <span className="text-foreground opacity-100">
                    <CheckCircleFillIcon />
                  </span>
                )}
              </DropdownMenuItem>
            </>
          )}

          {/* 4. Dark mode */}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-2"
            data-testid="header-user-nav-item-theme"
            onSelect={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
          >
            {resolvedTheme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            {`Toggle ${resolvedTheme === "light" ? "dark" : "light"} mode`}
          </DropdownMenuItem>

          {/* 5. Delete all chats */}
          {user && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="flex cursor-pointer items-center gap-2 text-destructive focus:text-destructive"
                data-testid="header-user-nav-item-delete-all"
                onSelect={() => setShowDeleteAllDialog(true)}
              >
                <TrashIcon size={16} />
                Delete all chats
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        onOpenChange={setShowDeleteAllDialog}
        open={showDeleteAllDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all chats?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete all
              your chats and remove them from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll}>
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
