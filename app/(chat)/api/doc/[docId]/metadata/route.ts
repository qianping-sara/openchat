import type { NextRequest } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { OpenChatError } from "@/lib/errors";

const PAGEINDEX_API_URL = "https://api.pageindex.ai";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ docId: string }> }
) {
  const { docId } = await context.params;

  if (!docId || typeof docId !== "string" || !docId.trim()) {
    return new OpenChatError(
      "bad_request:api",
      "Document ID is required."
    ).toResponse();
  }

  const session = await auth();
  if (!session?.user) {
    return new OpenChatError("unauthorized:chat").toResponse();
  }

  const apiKey = process.env.PAGEINDEX_API_KEY;
  if (!apiKey) {
    return new OpenChatError(
      "bad_request:api",
      "PageIndex API is not configured."
    ).toResponse();
  }

  const response = await fetch(
    `${PAGEINDEX_API_URL}/doc/${encodeURIComponent(docId.trim())}`,
    {
      method: "GET",
      headers: {
        api_key: apiKey,
      },
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      return new OpenChatError(
        "not_found:document",
        "Document not found or not accessible."
      ).toResponse();
    }
    const text = await response.text();
    return Response.json(
      {
        code: "bad_request:api",
        message: "Failed to fetch document metadata from PageIndex.",
        cause: response.status === 401 ? "Invalid API key" : text.slice(0, 200),
      },
      { status: response.status >= 500 ? 502 : 400 }
    );
  }

  const data = await response.json();
  return Response.json(data, { status: 200 });
}

