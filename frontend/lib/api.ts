const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
export const VOICE_API = process.env.NEXT_PUBLIC_VOICE_API_URL ?? "http://127.0.0.1:8001";

/**
 * Structured API Error capturing HTTP status, provider details,
 * and rate-limit / quota metadata for resilient client handling.
 */
export class ApiError extends Error {
  status: number;
  detail: string;
  retryAfterSeconds?: number;
  isRateLimit: boolean;
  isQuotaExceeded: boolean;
  isTimeout: boolean;
  isNetworkError: boolean;
  source?: string;

  constructor(
    message: string,
    info: {
      status?: number;
      detail?: string;
      retryAfterSeconds?: number;
      isRateLimit?: boolean;
      isQuotaExceeded?: boolean;
      isTimeout?: boolean;
      isNetworkError?: boolean;
      source?: string;
    } = {}
  ) {
    super(message);
    this.name = "ApiError";
    this.status = info.status ?? 500;
    this.detail = info.detail ?? message;
    this.retryAfterSeconds = info.retryAfterSeconds;
    this.isRateLimit = Boolean(info.isRateLimit);
    this.isQuotaExceeded = Boolean(info.isQuotaExceeded);
    this.isTimeout = Boolean(info.isTimeout);
    this.isNetworkError = Boolean(info.isNetworkError);
    this.source = info.source;
  }
}

/**
 * Extracts numeric cooldown in seconds from standard rate limit headers.
 */
function extractRetryAfter(res: Response): number | undefined {
  const retryHeader = res.headers.get("retry-after");
  if (retryHeader) {
    const val = parseInt(retryHeader, 10);
    if (!isNaN(val) && val > 0) return val;
  }
  const resetHeader = res.headers.get("ratelimit-reset");
  if (resetHeader) {
    const val = parseInt(resetHeader, 10);
    if (!isNaN(val) && val > 0) return val;
  }
  return undefined;
}

/**
 * Parses HTTP response error and categorizes rate limits, quota limits,
 * network errors, and provider-specific exceptions.
 */
function parseApiErrorResponse(res: Response, bodyText: string): ApiError {
  let detail = `API error ${res.status}`;
  let source: string | undefined;
  try {
    const json = JSON.parse(bodyText);
    if (json?.detail) {
      detail = String(json.detail);
    } else if (json?.error && typeof json.error === "object" && json.error.message) {
      detail = String(json.error.message);
    } else if (json?.error && typeof json.error === "string") {
      detail = json.error;
    } else if (json?.message) {
      detail = String(json.message);
    }
    if (json?.source) source = String(json.source);
  } catch {
    if (bodyText) detail = bodyText.slice(0, 300);
  }

  const dLower = detail.toLowerCase();
  const retryAfter = extractRetryAfter(res);

  const isRateLimit =
    res.status === 429 ||
    dLower.includes("rate limit") ||
    dLower.includes("ratelimit") ||
    dLower.includes("too many requests") ||
    dLower.includes("code: 429") ||
    dLower.includes("429");

  const isQuota =
    res.status === 402 ||
    dLower.includes("quota") ||
    dLower.includes("insufficient_quota") ||
    dLower.includes("credit balance") ||
    dLower.includes("code: 402") ||
    dLower.includes("exceeded your current quota");

  if (isRateLimit) {
    const msg = retryAfter
      ? `Rate limit reached. Please wait ${retryAfter} seconds before trying again.`
      : "The voice service is temporarily busy. Please try again shortly.";
    return new ApiError(msg, {
      status: 429,
      detail,
      retryAfterSeconds: retryAfter,
      isRateLimit: true,
      source,
    });
  }

  if (isQuota) {
    return new ApiError("Voice service request quota has been reached. Please try again later.", {
      status: 402,
      detail,
      isQuotaExceeded: true,
      source,
    });
  }

  return new ApiError(detail, {
    status: res.status,
    detail,
    source,
  });
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw parseApiErrorResponse(res, bodyText);
  }
  return res.json();
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  options?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 45000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (options?.signal) {
    options.signal.addEventListener("abort", () => controller.abort());
  }

  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError("The request timed out. Please try again.", { isTimeout: true });
    }
    console.error("[apiPost Network Error]", err);
    throw new ApiError("Voice service is unavailable. Please check your connection and try again.", {
      isNetworkError: true,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw parseApiErrorResponse(res, bodyText);
  }
  return res.json();
}

/**
 * Fetch helper for voice service with automatic failover between
 * configured VOICE_API and same-origin Next.js proxy (/voice/...).
 * This completely avoids CORS preflight blocking on http://127.0.0.1:3000.
 */
async function fetchVoice(path: string, init: RequestInit): Promise<Response> {
  const primaryUrl = path.startsWith("http") ? path : `${VOICE_API}${path}`;
  try {
    const res = await fetch(primaryUrl, init);
    // If FastAPI responded with 400 due to CORS origin mismatch on direct call
    if (res.status === 400 && typeof window !== "undefined" && primaryUrl.startsWith("http://127.0.0.1:8001")) {
      const proxyUrl = path.startsWith("http") ? path.replace("http://127.0.0.1:8001", "") : path;
      try {
        const proxyRes = await fetch(proxyUrl, init);
        if (proxyRes.ok || proxyRes.status < 400) return proxyRes;
      } catch {}
    }
    return res;
  } catch (err) {
    // If fetch failed due to CORS or network to 127.0.0.1:8001, try same-origin Next.js proxy
    if (typeof window !== "undefined" && (primaryUrl.startsWith("http://127.0.0.1:8001") || primaryUrl.startsWith("http://localhost:8001"))) {
      const proxyUrl = path.startsWith("http") ? path.replace(/^https?:\/\/[^/]+/, "") : path;
      try {
        const proxyRes = await fetch(proxyUrl, init);
        return proxyRes;
      } catch {}
    }
    throw err;
  }
}

/**
 * POST to the Python voice service with a multipart/form-data body.
 * Do NOT set Content-Type manually — the browser sets it with the correct boundary.
 */
export async function voicePostMultipart<T>(
  path: string,
  form: FormData,
  options?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (options?.signal) {
    options.signal.addEventListener("abort", () => controller.abort());
  }

  let res: Response;
  try {
    res = await fetchVoice(path, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError("The request timed out. Please try again.", { isTimeout: true });
    }
    console.error("[Voice STT Network Error]", err);
    throw new ApiError("Voice service is unavailable. Please check your connection and try again.", {
      isNetworkError: true,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    const parsed = parseApiErrorResponse(res, bodyText);

    // If Sarvam STT returned rate limit or quota exceeded
    if (parsed.isRateLimit || parsed.isQuotaExceeded) {
      throw parsed;
    }

    const dLower = parsed.detail.toLowerCase();
    if (res.status === 400 && dLower.includes("unsupported audio format")) {
      throw new ApiError("Audio format is not supported.", { status: 400, detail: parsed.detail });
    }
    if (res.status === 400 && dLower.includes("unsupported language")) {
      throw new ApiError("Language is not supported.", { status: 400, detail: parsed.detail });
    }
    if (res.status === 503) {
      throw new ApiError("Voice service is unavailable. Please check your connection and try again.", {
        status: 503,
        isNetworkError: true,
      });
    }

    throw new ApiError("Could not convert your speech into text.", { status: res.status, detail: parsed.detail });
  }

  return res.json();
}

/**
 * POST to the Python voice service and return the raw audio bytes as a Blob.
 * Used for /voice/speak which returns MP3 audio bytes.
 */
export async function voicePostJsonBlob(
  path: string,
  body: unknown,
  options?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<Blob> {
  const timeoutMs = options?.timeoutMs ?? 35000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (options?.signal) {
    options.signal.addEventListener("abort", () => controller.abort());
  }

  let res: Response;
  try {
    res = await fetchVoice(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError("The request timed out. Please try again.", { isTimeout: true });
    }
    console.error("[Voice TTS Network Error]", err);
    throw new ApiError("Voice service is unavailable. Please check your connection and try again.", {
      isNetworkError: true,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    const parsed = parseApiErrorResponse(res, bodyText);

    // If Sarvam TTS returned rate limit or quota exceeded
    if (parsed.isRateLimit || parsed.isQuotaExceeded) {
      throw parsed;
    }

    if (res.status === 503) {
      throw new ApiError("Voice service is unavailable. Please check your connection and try again.", {
        status: 503,
        isNetworkError: true,
      });
    }

    throw new ApiError("Audio generation failed. Your text answer is still available.", {
      status: res.status,
      detail: parsed.detail,
    });
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("audio") && !contentType.includes("octet-stream")) {
    throw new ApiError("Audio generation failed. Your text answer is still available.");
  }

  return res.blob();
}
