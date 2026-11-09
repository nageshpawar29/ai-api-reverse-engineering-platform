import { Request, Response } from 'express';
import { UserService } from '../services/userService';

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      const { email, password, name } = req.body;
      const existing = await UserService.findByEmail(email);
      if (existing) {
        return res.status(409).json({ error: 'User already exists' });
      }

      const user = await UserService.createUser({ email, name, passwordHash: 'hashed_pw' });
      return res.status(201).json({
        message: 'User registered successfully',
        user,
        token: 'jwt_token_sample',
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const user = await UserService.findByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      return res.status(200).json({
        token: 'sample_jwt_token',
        expiresIn: 3600,
        user,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  static async me(req: Request, res: Response) {
    return res.status(200).json({
      user: (req as any).user,
    });
  }
}
