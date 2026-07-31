import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase } from './config/schema';
import { Categories, Priorities, Statuses } from './utils/constants';
import { rateLimit } from './middleware/rateLimit';
import authRoutes from './routes/auth';
import ticketRoutes from './routes/tickets';
import commentRoutes from './routes/comments';

dotenv.config();

const app: Express = express();
const PORT = Number(process.env.PORT || 5000);

const corsWhitelist = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || corsWhitelist.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(rateLimit);

app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/tickets/:id/comments', commentRoutes);

app.get('/api/categories', (_req: Request, res: Response) => {
  res.json(Categories);
});

app.get('/api/priorities', (_req: Request, res: Response) => {
  res.json(Priorities);
});

app.get('/api/statuses', (_req: Request, res: Response) => {
  res.json(Statuses);
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'Server is running' });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err.message.includes('File too large')) {
    return res.status(400).json({ error: 'Attachment exceeds maximum allowed file size' });
  }

  if (err.message.includes('File type not allowed')) {
    return res.status(400).json({ error: err.message });
  }

  if (err.message.includes('CORS')) {
    return res.status(403).json({ error: 'Forbidden by CORS policy' });
  }

  return res.status(500).json({ error: 'Internal server error' });
});

const startServer = async () => {
  try {
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`✓ Server running on port ${PORT}`);
      console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('✗ Failed to start server');
    process.exit(1);
  }
};

startServer();

export default app;
