export interface SaleSummary {
  id: string;
  sellerUsername: string;
  createdAt: string;
  total: number;
  currency: string;
  itemsCount: number;
}

export interface SalesReportData {
  from: string;
  to: string;
  totalAmount: number;
  currency: string;
  items: Array<{
    productId: string;
    productName: string;
    unitsSold: number;
    totalAmount: number;
  }>;
}

export interface ISalesRepository {
  placeSale(items: Array<{ productId: string; quantity: number }>): Promise<void>;
  listSales(page?: number): Promise<{ items: SaleSummary[]; total: number; totalPages: number }>;
  getReport(from: string, to: string): Promise<SalesReportData>;
}