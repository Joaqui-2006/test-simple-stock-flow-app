import { IProductRepository } from '../application/ports/IProductRepository';
import { ISalesRepository } from '../application/ports/ISalesRepository';
import { ISessionRepository, UserSession } from '../application/ports/ISessionRepository';
import { ApiAuthResponse, ApiPagedResult, ApiProductDto } from './http/dto/api.dto';
import { HttpClient } from './http/httpClient';
import { ProductMapper } from './mappers/ProductMapper';

class LocalSessionRepository implements ISessionRepository {
  private key = 'stockflow_session';

  getSession(): UserSession | null {
    const raw = localStorage.getItem(this.key);
    return raw ? JSON.parse(raw) : null;
  }

  setSession(session: UserSession): void {
    localStorage.setItem(this.key, JSON.stringify(session));
  }

  clearSession(): void {
    localStorage.removeItem(this.key);
  }
}

export const sessionRepo = new LocalSessionRepository();
export const httpClient = new HttpClient(() => sessionRepo.getSession()?.token || null);

class ApiProductRepository implements IProductRepository {
  async list(search?: string, categoryId?: string, page: number = 1) {
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set('search', search);
    if (categoryId) params.set('categoryId', categoryId);

    const data = await httpClient.request<ApiPagedResult<ApiProductDto>>(`/api/products?${params.toString()}`);
    return {
      items: data.items.map(ProductMapper.toDomain),
      total: data.total,
      totalPages: data.totalPages,
    };
  }

  async create(name: string, price: number, initialStock: number, categoryId: string) {
    const dto = await httpClient.request<ApiProductDto>('/api/products', {
      method: 'POST',
      body: JSON.stringify({ name, price, initialStock, categoryId }),
    });
    return ProductMapper.toDomain(dto);
  }

  async update(id: string, name: string, price: number, categoryId: string) {
    const dto = await httpClient.request<ApiProductDto>(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, price, categoryId }),
    });
    return ProductMapper.toDomain(dto);
  }

  async delete(id: string) {
    await httpClient.request<void>(`/api/products/${id}`, { method: 'DELETE' });
  }

  async uploadImage(id: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await httpClient.request<{ imageUrl: string }>(`/api/products/${id}/image`, {
      method: 'POST',
      body: formData,
    });
    return res.imageUrl;
  }

  async listCategories() {
    return httpClient.request<Array<{ id: string; name: string }>>('/api/categories');
  }
}

class ApiSalesRepository implements ISalesRepository {
  async placeSale(items: Array<{ productId: string; quantity: number }>) {
    await httpClient.request<void>('/api/sales', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  }

  async listSales(page: number = 1) {
    const data = await httpClient.request<ApiPagedResult<any>>(`/api/sales?page=${page}`);
    return {
      items: data.items.map((s: any) => ({
        id: s.id,
        sellerUsername: s.sellerUsername,
        createdAt: s.createdAt,
        total: s.total,
        currency: s.currency,
        itemsCount: s.items.length,
      })),
      total: data.total,
      totalPages: data.totalPages,
    };
  }

  async getReport(from: string, to: string) {
    return httpClient.request<any>(`/api/reports/sales?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  }
}

export const productRepo = new ApiProductRepository();
export const salesRepo = new ApiSalesRepository();

export async function apiLogin(username: string, password: string):Promise<UserSession> {
  const res = await httpClient.request<ApiAuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  const session: UserSession = {
    token: res.token,
    userId: res.user.id,
    username: res.user.username,
    role: res.user.role,
  };
  sessionRepo.setSession(session);
  return session;
}