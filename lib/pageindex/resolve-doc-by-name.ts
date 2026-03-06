const PAGEINDEX_API_URL = "https://api.pageindex.ai";
const LIST_LIMIT = 100;
const TOTAL_CAP = 500;

type PageIndexDocument = {
  id: string;
  name: string;
};

type ListDocumentsResponse = {
  documents: PageIndexDocument[];
  total: number;
  limit: number;
  offset: number;
};

function findDocumentByName(
  documents: PageIndexDocument[],
  searchName: string
): PageIndexDocument | null {
  const trimmed = searchName.trim();
  if (!trimmed) return null;

  const exact = documents.find((d) => d.name.trim() === trimmed);
  if (exact) return exact;

  const lower = trimmed.toLowerCase();
  const caseInsensitive = documents.find(
    (d) => d.name.trim().toLowerCase() === lower
  );
  if (caseInsensitive) return caseInsensitive;

  const includes = documents.find(
    (d) =>
      d.name.trim().includes(trimmed) || trimmed.includes(d.name.trim())
  );
  return includes ?? null;
}

export type ResolveResult =
  | { ok: true; docId: string; docName: string }
  | { ok: false; error: string };

/**
 * Resolve doc_name to doc_id via PageIndex List Documents API.
 * Uses PAGEINDEX_API_KEY from env.
 */
export async function resolveDocByName(
  name: string
): Promise<ResolveResult> {
  const trimmed = name?.trim();
  if (!trimmed) {
    return { ok: false, error: "name is required" };
  }

  const apiKey = process.env.PAGEINDEX_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "PageIndex API is not configured" };
  }

  let offset = 0;

  while (offset < TOTAL_CAP) {
    const url = new URL(`${PAGEINDEX_API_URL}/docs`);
    url.searchParams.set("limit", String(LIST_LIMIT));
    url.searchParams.set("offset", String(offset));

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { api_key: apiKey },
    });

    if (!response.ok) {
      return {
        ok: false,
        error:
          response.status === 401
            ? "Invalid API key"
            : `PageIndex API error: ${response.status}`,
      };
    }

    const data = (await response.json()) as ListDocumentsResponse;
    const { documents, total } = data;

    const found = findDocumentByName(documents, trimmed);
    if (found) {
      return { ok: true, docId: found.id, docName: found.name };
    }

    offset += documents.length;
    if (documents.length === 0 || offset >= total) {
      break;
    }
  }

  return { ok: false, error: `No document found matching: ${trimmed}` };
}
