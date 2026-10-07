export interface ApiProductDto {
  id: string;
  name: string;
  price: number;
  currency: string;
  stock: number;
  categoryId: string;
  categoryName: string;
  imageUrl?: string | null;
}

export interface ApiPagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiAuthResponse {
  token: string;
  user: {
    id: string;
    username: string;
    role: 'admin' | 'seller';
  };
}

export interface ApiProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  errors?: Record<string, string[]>;
}