import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, UserController.getAllUsers);
router.get('/:id', requireAuth, UserController.getUserProfile);
router.delete('/:id', requireAuth, UserController.deleteAccount);

export default router;
