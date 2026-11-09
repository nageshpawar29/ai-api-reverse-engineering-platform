export class ProductService {
  static async list(category?: string, maxPrice?: number) {
    return [
      { id: 'prod-1', title: 'Mechanical Keyboard', price: 99.99, category: 'Electronics' },
      { id: 'prod-2', title: 'Wireless Mouse', price: 49.99, category: 'Electronics' },
    ];
  }

  static async getById(id: string) {
    return { id, title: 'Mechanical Keyboard', price: 99.99, stock: 45 };
  }

  static async create(payload: { title: string; price: number; category: string; description?: string }) {
    return { id: 'prod-3', ...payload };
  }

  static async update(id: string, payload: any) {
    return { id, ...payload };
  }

  static async remove(id: string) {
    return { success: true, deletedId: id };
  }
}
