const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

async function parseError(res: Response): Promise<string> {
  let detail = `API error ${res.status}`;
  try {
    const body = await res.json();
    if (body?.detail) detail = String(body.detail);
  } catch {}
  return detail;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}