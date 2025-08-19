import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { router as apiRouter } from './routes/index.js';
import { notFoundMiddleware } from './middlewares/notFoundMiddleware.js';
import { errorMiddleware } from './middlewares/errorMiddleware.js';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));


app.use((req, _res, next) => {
  if (!req.body) return next();
  const cookieSession = req.cookies?.sessionId;
  if (cookieSession && !req.body.sessionId && !req.headers['x-session-id']) {
    req.body.sessionId = cookieSession;
  }
  next();
});

app.use('/api/v1', apiRouter);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));

export default app;
