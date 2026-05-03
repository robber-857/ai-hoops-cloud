const ACCESS_TOKEN_STORAGE_KEY = "ai-hoops-access-token";

export function getAuthAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function setAuthAccessToken(token: string | null): void {
  if (typeof window === "undefined") {
    return;
  }

  if (token) {
    window.sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
    return;
  }

  window.sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function clearAuthAccessToken(): void {
  setAuthAccessToken(null);
}
