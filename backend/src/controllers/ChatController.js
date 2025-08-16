import { z } from 'zod';
import { ChatService } from '../services/ChatService.js';

const schema = z.object({
  message: z.string().min(1),
  sessionId: z.string().optional(),
});

export class ChatController {
  constructor() {
    this.chatService = new ChatService();
  }

  async handleMessage(req, res, next) {
    try {
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'BadRequest' });
      const headerSession = req.headers['x-session-id'];
      const { message, sessionId } = parsed.data;
      const response = await this.chatService.processUserMessage({ message, sessionId: sessionId || headerSession });
      if (response?.sessionId) res.set('X-Session-Id', response.sessionId);
      return res.status(200).json(response);
    } catch (e) {
      next(e);
    }
  }
}


