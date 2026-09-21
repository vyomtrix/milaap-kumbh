import { getAccessToken } from "@/lib/auth";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

export async function apiFetch(path: string, options: RequestInit = {}) {
  const accessToken = getAccessToken();
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "ngrok-skip-browser-warning": "true",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers || {}),
    },
  });
}
