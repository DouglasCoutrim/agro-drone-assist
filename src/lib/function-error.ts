/** Reads handled HTTP errors without consuming the original response. */
export async function functionErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (error && typeof error === "object" && "context" in error && error.context instanceof Response) {
    try {
      const body = await error.context.clone().json();
      if (typeof body?.error === "string" && body.error.trim()) return body.error;
    } catch { /* Network/proxy responses may not contain JSON. */ }
  }
  return fallback;
}