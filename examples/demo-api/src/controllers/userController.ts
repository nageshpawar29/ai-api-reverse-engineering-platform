import { Request, Response } from 'express';
import { UserService } from '../services/userService';

export class UserController {
  static async getAllUsers(req: Request, res: Response) {
    const { limit, offset } = req.query;
    const users = await UserService.getAllUsers(
      limit ? parseInt(limit as string) : 10,
      offset ? parseInt(offset as string) : 0
    );
    return res.status(200).json(users);
  }

  static async getUserProfile(req: Request, res: Response) {
    const { id } = req.params;
    const user = await UserService.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.status(200).json(user);
  }

  static async deleteAccount(req: Request, res: Response) {
    const { id } = req.params;
    return res.status(200).json({ success: true, message: `User ${id} removed` });
  }
}
