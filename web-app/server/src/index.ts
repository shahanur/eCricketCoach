import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { drillsRouter } from './routes/drills.js';
import { adminRouter } from './routes/admin.js';
import { clubRouter } from './routes/club.js';
import { subscriptionsRouter } from './routes/subscriptions.js';
import { aiRouter } from './routes/ai.js';
import { authRouter } from './routes/auth.js';
import { initDb } from './config/initDb.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5001;

// Global Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Initialize Database & Seeds
initDb().catch(err => {
  console.error('⚠️ Database initialization error:', err);
});

// Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'eCricketCoach Microservices API Gateway',
    version: '1.1.0',
    timestamp: new Date().toISOString()
  });
});

// Modular Routes & Microservice Endpoints
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/auth', authRouter);
app.use('/api/drills', drillsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/club', clubRouter);
app.use('/api/videos', aiRouter);

// Start Server
app.listen(port, () => {
  console.log(`🏏 eCricketCoach Microservices API Gateway listening on http://localhost:${port}`);
});
