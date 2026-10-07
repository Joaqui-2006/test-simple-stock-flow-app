import test from 'node:test';
import assert from 'node:assert/strict';

// Test pure logic matching Money and Cart invariants
class Money {
  constructor(amount, currency = 'COP') {
    this.amount = Math.round(amount * 100) / 100;
    this.currency = currency;
  }
  multiply(factor) {
    return new Money(this.amount * factor, this.currency);
  }
  add(other) {
    return new Money(this.amount + other.amount, this.currency);
  }
}

class Cart {
  constructor(items = []) {
    this.items = items;
  }
  addItem(product, quantity = 1) {
    const existingIndex = this.items.findIndex(i => i.product.id === product.id);
    const newQty = existingIndex >= 0 ? this.items[existingIndex].quantity + quantity : quantity;
    if (newQty > product.stock) {
      throw new Error(`El stock disponible (${product.stock}) es insuficiente`);
    }
    let updated;
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
  removeItem(productId) {
    return new Cart(this.items.filter(i => i.product.id !== productId));
  }
  getTotal() {
    if (this.items.length === 0) return new Money(0, 'COP');
    return this.items.reduce((acc, curr) => acc.add(curr.subtotal), new Money(0, this.items[0].subtotal.currency));
  }
}

test('Cart accumulates items and calculates total dynamically', () => {
  const p1 = { id: 'p1', name: 'Café Especial', price: new Money(24000, 'COP'), stock: 10 };
  const p2 = { id: 'p2', name: 'Té Verde', price: new Money(12500, 'COP'), stock: 5 };

  let cart = new Cart();
  cart = cart.addItem(p1, 2);
  cart = cart.addItem(p2, 1);

  assert.equal(cart.items.length, 2);
  // 24000 * 2 + 12500 * 1 = 60500
  assert.equal(cart.getTotal().amount, 60500);
});

test('Cart throws Error when adding more than available stock', () => {
  const p = { id: 'p1', name: 'Galletas', price: new Money(4500, 'COP'), stock: 3 };
  let cart = new Cart();

  assert.throws(() => {
    cart.addItem(p, 5);
  }, /El stock disponible/);
});

test('Cart allows removing items', () => {
  const p1 = { id: 'p1', name: 'Café', price: new Money(10000, 'COP'), stock: 10 };
  let cart = new Cart();
  cart = cart.addItem(p1, 1);
  assert.equal(cart.items.length, 1);

  cart = cart.removeItem('p1');
  assert.equal(cart.items.length, 0);
  assert.equal(cart.getTotal().amount, 0);
});
