export type AuthSession = {
  token: string;
  role: "admin" | "authority";
  authorityId?: number;
  name?: string;
};

const SESSION_KEY = "milaap-auth-session";

export function getSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const stored = window.sessionStorage.getItem(SESSION_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as AuthSession;
  } catch {
    window.sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function saveSession(session: AuthSession) {
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  window.sessionStorage.removeItem(SESSION_KEY);
}

export function getAccessToken(): string | null {
  return getSession()?.token ?? null;
}
