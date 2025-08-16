import { Router } from 'express';
import { ChatController } from '../controllers/ChatController.js';

export const router = Router();
const controller = new ChatController();

router.post('/', (req, res, next) => controller.handleMessage(req, res, next));


