import { Request, Response } from 'express';
import { ProductService } from '../services/productService';

export class ProductController {
  static async listProducts(req: Request, res: Response) {
    try {
      const { category, maxPrice } = req.query;
      const products = await ProductService.list(
        category as string,
        maxPrice ? parseFloat(maxPrice as string) : undefined
      );
      return res.status(200).json({
        count: products.length,
        items: products,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  static async getProductById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const product = await ProductService.getById(id);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
      return res.status(200).json(product);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  static async createProduct(req: Request, res: Response) {
    try {
      const { title, price, category, description, stock } = req.body;
      const product = await ProductService.create({ title, price, category, description });
      return res.status(201).json({
        message: 'Product created',
        product,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  static async updateProduct(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { title, price, stock } = req.body;
      const updated = await ProductService.update(id, { title, price, stock });
      return res.status(200).json(updated);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  static async deleteProduct(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await ProductService.remove(id);
      return res.status(200).json({ message: 'Product deleted' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
}
