import { Request, Response, NextFunction } from 'express';

export function validateUserRegistration(req: Request, res: Response, next: NextFunction) {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Validation failed: email, password, and name are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  next();
}

export function validateProduct(req: Request, res: Response, next: NextFunction) {
  const { title, price, category } = req.body;
  if (!title || price === undefined || !category) {
    return res.status(400).json({ error: 'Validation failed: title, price, and category are required' });
  }
  next();
}
