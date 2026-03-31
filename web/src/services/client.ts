const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:8000/api/v1";

type JsonValue = Record<string, unknown> | null;

async function parseResponse(response: Response): Promise<JsonValue> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as JsonValue;
  } catch {
    return { message: text };
  }
}

function getErrorMessage(payload: JsonValue, fallback: string): string {
  if (!payload) {
    return fallback;
  }

  const detail = payload.detail;
  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item === "object" && "msg" in item) {
          return String(item.msg);
        }
        return JSON.stringify(item);
      })
      .join(", ");
  }

  if (typeof payload.message === "string") {
    return payload.message;
  }

  return fallback;
}

export async function apiRequest<TResponse>(
  path: string,
  init: RequestInit = {},
): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const payload = await parseResponse(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, `Request failed with ${response.status}`));
  }

  return payload as TResponse;
}

export { API_BASE_URL };
