export class HttpClient {
  constructor(private readonly getAuthToken: () => string | null) {}

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});
    const token = this.getAuthToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(path, { ...options, headers });

    if (res.status === 204) {
      return {} as T;
    }

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Sesión expirada o no autorizada');
      }
      if (res.status === 403) {
        throw new Error('No tienes permisos suficientes para realizar esta acción');
      }

      try {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Ocurrió un error en la solicitud');
      } catch (err: any) {
        throw new Error(err.message || 'Error en la comunicación con el servidor');
      }
    }

    return (await res.json()) as T;
  }
}