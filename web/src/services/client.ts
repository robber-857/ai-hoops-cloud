function normalizeLoopbackHostname(baseUrl: string): string {
  if (typeof window === "undefined") {
    return baseUrl;
  }

  const currentHost = window.location.hostname;
  const currentProtocol = window.location.protocol;
  const isLoopbackHost = currentHost === "localhost" || currentHost === "127.0.0.1";

  if (!isLoopbackHost) {
    return baseUrl;
  }

  try {
    const parsed = new URL(baseUrl);
    const isLoopbackApiHost =
      parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";

    if (!isLoopbackApiHost) {
      return baseUrl;
    }

    parsed.hostname = currentHost;
    parsed.protocol = currentProtocol;
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return baseUrl;
  }
}

function resolveApiBaseUrl(): string {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");

  if (configuredBaseUrl) {
    return normalizeLoopbackHostname(configuredBaseUrl);
  }

  if (process.env.NODE_ENV !== "production") {
    return normalizeLoopbackHostname("http://localhost:8000/api/v1");
  }

  throw new Error("Missing NEXT_PUBLIC_API_BASE_URL for the production deployment.");
}

const API_BASE_URL = resolveApiBaseUrl();

type JsonValue = Record<string, unknown> | null;

type ValidationErrorItem = {
  type?: string;
  loc?: unknown;
  msg?: string;
  ctx?: Record<string, unknown>;
};

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
    const messages = detail
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (item && typeof item === "object") {
          const errorItem = item as ValidationErrorItem;
          const location = Array.isArray(errorItem.loc)
            ? errorItem.loc[errorItem.loc.length - 1]
            : undefined;

          if (errorItem.type === "string_too_short" && location === "username") {
            return "Username must be at least 3 characters.";
          }

          if (
            errorItem.type === "string_too_short" &&
            (location === "password" || location === "confirm_password")
          ) {
            return "Password must be at least 8 characters.";
          }

          if (errorItem.msg === "confirm_password must match password") {
            return "Passwords do not match.";
          }

          if ("msg" in errorItem && typeof errorItem.msg === "string") {
            return errorItem.msg;
          }
        }

        return JSON.stringify(item);
      })
      .filter((message, index, list) => Boolean(message) && list.indexOf(message) === index);

    return messages.join(" ");
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
    credentials: "include",
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
