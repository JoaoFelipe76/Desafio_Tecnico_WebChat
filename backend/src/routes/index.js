import { Router } from 'express';
import { router as chatRouter } from './chat.routes.js';

export const router = Router();
router.use('/chat', chatRouter);


