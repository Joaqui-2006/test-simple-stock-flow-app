import { Money } from './Money';
import { Product } from './Product';

export interface CartItem {
  product: Product;
  quantity: number;
  subtotal: Money;
}

export class Cart {
  constructor(public readonly items: CartItem[] = []) {}

  addItem(product: Product, quantity: number = 1): Cart {
    const existingIndex = this.items.findIndex(i => i.product.id === product.id);
    const newQty = existingIndex >= 0 ? this.items[existingIndex].quantity + quantity : quantity;

    if (newQty > product.stock) {
      throw new Error(`El stock disponible (${product.stock}) es insuficiente`);
    }

    let updated: CartItem[];
    if (existingIndex >= 0) {
      updated = [...this.items];
      updated[existingIndex] = {
        product,
        quantity: newQty,
        subtotal: product.price.multiply(newQty),
      };
    } else {
      updated = [...this.items, { product, quantity, subtotal: product.price.multiply(quantity) }];
    }

    return new Cart(updated);
  }

  removeItem(productId: string): Cart {
    return new Cart(this.items.filter(i => i.product.id !== productId));
  }

  clear(): Cart {
    return new Cart([]);
  }

  getTotal(): Money {
    if (this.items.length === 0) return new Money(0, 'COP');
    return this.items.reduce((acc, curr) => acc.add(curr.subtotal), new Money(0, this.items[0].subtotal.currency));
  }
}