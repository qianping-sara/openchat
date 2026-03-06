import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { resolveDocByName } from "@/lib/pageindex/resolve-doc-by-name";

type PageProps = {
  searchParams: Promise<{ name?: string; page?: string }>;
};

export default async function DocByNamePage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/api/auth/guest");
  }

  const params = await searchParams;
  const name = params.name;
  const page = params.page;

  if (!name || typeof name !== "string" || !name.trim()) {
    redirect("/");
  }

  const result = await resolveDocByName(name.trim());

  if (!result.ok) {
    redirect("/");
  }

  const pageParam =
    page && typeof page === "string" && /^\d+$/.test(page.trim())
      ? `?page=${page.trim()}`
      : "";

  redirect(`/doc/${encodeURIComponent(result.docId)}${pageParam}`);
}
