export class GuestApiError extends Error {
  readonly kind: "configuration" | "network" | "response" | "not-found";
  constructor(kind: "configuration" | "network" | "response" | "not-found") {
    super(kind);
    this.kind = kind;
    this.name = "GuestApiError";
  }
}

export async function guestJson(path: string, params: URLSearchParams, baseUrl: string | undefined, request: typeof fetch): Promise<unknown> {
  let url: URL;
  try {
    if (!baseUrl) throw new Error();
    url = new URL(baseUrl);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
    url.pathname = `${url.pathname.replace(/\/$/, "")}/${path}`;
    url.search = params.toString();
  } catch { throw new GuestApiError("configuration"); }
  let response: Response;
  try {
    response = await request(url, {
      cache: "no-store", credentials: "omit", headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
  } catch { throw new GuestApiError("network"); }
  if (response.status === 404) throw new GuestApiError("not-found");
  if (!response.ok) throw new GuestApiError("response");
  try { return await response.json(); } catch { throw new GuestApiError("response"); }
}
