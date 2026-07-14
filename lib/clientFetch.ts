// Safe JSON fetch for client components: never throws "Unexpected end of
// JSON input" on an empty error body, and surfaces server errors as messages.
export async function postJson<T = Record<string, unknown>>(
  url: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // empty or non-JSON body — fall through to status handling
  }
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  if (data === null) throw new Error("empty response from server");
  return data as T;
}
