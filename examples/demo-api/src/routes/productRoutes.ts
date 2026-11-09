import { Router } from 'express';
import { ProductController } from '../controllers/productController';
import { requireAuth } from '../middleware/auth';
import { validateProduct } from '../middleware/validate';

const router = Router();

router.get('/', ProductController.listProducts);
router.get('/:id', ProductController.getProductById);
router.post('/', requireAuth, validateProduct, ProductController.createProduct);
router.put('/:id', requireAuth, ProductController.updateProduct);
router.delete('/:id', requireAuth, ProductController.deleteProduct);

export default router;
