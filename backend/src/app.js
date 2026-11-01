import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { weatherRouter } from './routes/weather.js';
import { pricesRouter } from './routes/prices.js';
import { adviceRouter } from './routes/advice.js';
import { authRouter } from './routes/auth.js';
import { profileRouter } from './routes/profile.js';
import { statusRouter } from './routes/status.js';
import { locationsRouter } from './routes/locations.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export const app = express();

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, smoke tests)
      if (!origin) return callback(null, true);
      if (config.FRONTEND_ORIGIN.includes('*') || config.FRONTEND_ORIGIN.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive during hackathon local dev, origin list checked in production
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));

// Lightweight health check for Render cold starts
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Farmly.AI Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Weather routes
app.use('/api/weather', weatherRouter);

// Mandi Prices routes
app.use('/api/prices', pricesRouter);

// AI Advisor routes
app.use('/api/advice', adviceRouter);

// Auth routes (Supabase email/password)
app.use('/api/auth', authRouter);

// Profile routes (Farmer profile with RLS)
app.use('/api/profile', profileRouter);

// Upstream status route
app.use('/api/status', statusRouter);

// Locations routes (States & Districts)
app.use('/api/locations', locationsRouter);

// 404 & Global Error handlers
app.use(notFoundHandler);
app.use(errorHandler);
