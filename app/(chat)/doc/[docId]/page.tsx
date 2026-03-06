import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { DocPreview } from "@/components/doc-preview";

type PageProps = {
  params: Promise<{ docId: string }>;
};

export default function DocPage({ params }: PageProps) {
  return (
    <Suspense fallback={<div className="flex h-dvh items-center justify-center">加载中…</div>}>
      <DocPageContent params={params} />
    </Suspense>
  );
}

async function DocPageContent({ params }: PageProps) {
  const { docId } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect("/api/auth/guest");
  }

  if (!docId || typeof docId !== "string" || !docId.trim()) {
    redirect("/");
  }

  return (
    <main className="h-full overflow-y-auto">
      <DocPreview docId={docId.trim()} />
    </main>
  );
}
