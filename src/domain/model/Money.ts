export class Money {
  constructor(public readonly amount: number, public readonly currency: string = 'COP') {
    if (amount < 0) {
      throw new Error('El importe monetario no puede ser negativo');
    }
  }

  format(): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: this.currency,
      minimumFractionDigits: 2,
    }).format(this.amount);
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('No se pueden sumar importes en distintas monedas');
    }
    return new Money(this.amount + other.amount, this.currency);
  }

  multiply(qty: number): Money {
    return new Money(this.amount * qty, this.currency);
  }
}