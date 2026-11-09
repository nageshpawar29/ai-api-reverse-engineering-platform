import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { requireAuth } from '../middleware/auth';
import { validateUserRegistration } from '../middleware/validate';

const router = Router();

router.post('/register', validateUserRegistration, AuthController.register);
router.post('/login', AuthController.login);
router.get('/me', requireAuth, AuthController.me);

export default router;
