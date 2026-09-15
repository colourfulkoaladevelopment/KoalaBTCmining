import AsyncStorage from '@react-native-async-storage/async-storage';

const RAW_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const BACKEND_URL = RAW_URL
  .replace(/^http:\/\//i, 'https://')
  .replace(/\/+$/, '');

const AUTH_ROUTES = ['/api/auth/login', '/api/auth/register', '/api/auth/logout'];

export async function getAuthToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem('session_token');
  } catch {
    return null;
  }
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; data: T; status: number }> {
  const isAuthRoute = AUTH_ROUTES.some((r) => path.startsWith(r));
  const token = !isAuthRoute ? await getAuthToken() : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    return { ok: false, data: null as T, status: 0 };
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return { ok: response.ok, data, status: response.status };
}

export async function clearSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem('session_token');
    await AsyncStorage.removeItem('user_data');
  } catch {
    // Session may already be cleared
  }
}

export { BACKEND_URL };
