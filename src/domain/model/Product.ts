import { Money } from './Money';

export interface Product {
  id: string;
  name: string;
  price: Money;
  stock: number;
  categoryId: string;
  categoryName: string;
  imageUrl?: string | null;
}