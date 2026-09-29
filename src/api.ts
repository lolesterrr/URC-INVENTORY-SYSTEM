/** Thin fetch wrapper: JSON in/out, session cookie sent automatically, errors thrown with the server's message. */
export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export const SESSION_EXPIRED_EVENT = 'urc:session-expired';

export async function api<T = unknown>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: options.method ?? 'GET',
    credentials: 'same-origin',
    headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const fieldErrors = Array.isArray(data.fields)
      ? ' ' + data.fields.map((f: { field: string; message: string }) => `${f.field}: ${f.message}`).join('; ')
      : '';
    // Tell the app to show the sign-in screen, except for the sign-in call itself.
    if (res.status === 401 && !path.startsWith('/api/auth/')) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    throw new ApiError(res.status, (data.error ?? `Request failed (${res.status}).`) + fieldErrors, data.code);
  }
  return data as T;
}
