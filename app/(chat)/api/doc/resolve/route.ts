import type { NextRequest } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { OpenChatError } from "@/lib/errors";
import { resolveDocByName } from "@/lib/pageindex/resolve-doc-by-name";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const name = searchParams.get("name");

  if (!name || typeof name !== "string" || !name.trim()) {
    return new OpenChatError(
      "bad_request:api",
      "Query parameter 'name' is required and must be non-empty."
    ).toResponse();
  }

  const session = await auth();
  if (!session?.user) {
    return new OpenChatError("unauthorized:chat").toResponse();
  }

  const result = await resolveDocByName(name);

  if (!result.ok) {
    if (result.error.includes("No document found")) {
      return new OpenChatError("not_found:document", result.error).toResponse();
    }
    return new OpenChatError(
      "bad_request:api",
      result.error
    ).toResponse();
  }

  return Response.json(
    { docId: result.docId, docName: result.docName },
    { status: 200 }
  );
}
