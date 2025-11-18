import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { connectRedis } from './config/redis';
import { kafkaProducer } from './config/kafka';
import { logger, morganStream } from './utils/logger';
import { errorHandler, notFoundHandler } from './utils/error';
import { userRoutes } from './modules/users/user.routes';
import { productRoutes } from './modules/products/product.routes';
import { authRoutes } from './modules/auth/auth.routes';
import morgan from 'morgan';

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: [env.FRONTEND_URL, 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Logging middleware
app.use(morgan('combined', { stream: morganStream }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: env.NODE_ENV,
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);

// Admin routes
app.get('/api/admin/health', (req, res) => {
  res.json({
    success: true,
    message: 'Admin API is healthy',
    services: {
      database: 'connected',
      redis: 'connected',
      kafka: 'connected',
    },
  });
});

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Graceful shutdown handling
const gracefulShutdown = async () => {
  logger.info('Starting graceful shutdown...');
  
  try {
    await kafkaProducer.disconnect();
    logger.info('Kafka producer disconnected');
  } catch (error) {
    logger.error('Error disconnecting Kafka producer:', error);
  }
  
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const startServer = async () => {
  try {
    // Connect to Redis
    await connectRedis();
    
    // Connect Kafka producer
    await kafkaProducer.connect();
    
    // Start HTTP server
    const port = parseInt(env.PORT);
    const server = app.listen(port, '0.0.0.0', () => {
      logger.info(`🚀 Server running on port ${port} in ${env.NODE_ENV} mode`);
      logger.info(`📱 Frontend URL: ${env.FRONTEND_URL}`);
      logger.info(`🔗 API URL: http://localhost:${port}`);
      logger.info(`📊 Health check: http://localhost:${port}/health`);
    });

    // Handle server errors
    server.on('error', (error) => {
      logger.error('Server error:', error);
      process.exit(1);
    });

    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the application
if (require.main === module) {
  startServer();
}

export { app, startServer };