import { Product } from '../../domain/model/Product';

export interface IProductRepository {
  list(search?: string, categoryId?: string, page?: number): Promise<{ items: Product[]; total: number; totalPages: number }>;
  create(name: string, price: number, initialStock: number, categoryId: string): Promise<Product>;
  update(id: string, name: string, price: number, categoryId: string): Promise<Product>;
  delete(id: string): Promise<void>;
  uploadImage(id: string, file: File): Promise<string>;
  listCategories(): Promise<Array<{ id: string; name: string }>>;
}