/** Extract error message from a failed fetch response */
export async function extractError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json()
    return body.error ?? body.message ?? fallback
  } catch {
    return fallback
  }
}

/** Fetch wrapper that returns JSON or throws with server error message */
export async function fetchJson<T>(url: string, options?: RequestInit, fallback?: string): Promise<T> {
  const res = await fetch(url, options)
  if (!res.ok) {
    throw new Error(await extractError(res, fallback ?? `Request failed (${res.status})`))
  }
  return res.json()
}

/** Fetch wrapper for requests that return no body (204 etc), throws with server error message */
export async function fetchVoid(url: string, options?: RequestInit, fallback?: string): Promise<void> {
  const res = await fetch(url, options)
  if (!res.ok) {
    throw new Error(await extractError(res, fallback ?? `Request failed (${res.status})`))
  }
}
