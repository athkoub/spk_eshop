import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import axios from 'axios';
import { z } from 'zod';
import winston from 'winston';
import dotenv from 'dotenv';

dotenv.config();

// Environment configuration
const env = z.object({
  KAFKA_BROKER: z.string(),
  KAFKA_USERNAME: z.string().optional(),
  KAFKA_PASSWORD: z.string().optional(),
  KAFKA_CLIENT_ID: z.string().default('grocery-erp-sync'),
  KAFKA_GROUP_ID: z.string().default('erp-sync-group'),
  BACKEND_URL: z.string(),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
}).parse(process.env);

// Logger configuration
const logger = winston.createLogger({
  level: env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/worker.log' }),
  ],
});

// Kafka topics
const TOPICS = {
  PRODUCT_UPDATES: 'product_updates',
  PRICE_UPDATES: 'price_updates',
  STOCK_UPDATES: 'stock_updates',
} as const;

// Message schemas
const productUpdateMessageSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  sku: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  weight: z.number().optional(),
  unit: z.string().optional(),
  isActive: z.boolean().optional(),
  timestamp: z.number(),
});

const priceUpdateMessageSchema = z.object({
  productId: z.string().optional(),
  sku: z.string(),
  price: z.number().min(0),
  timestamp: z.number(),
});

const stockUpdateMessageSchema = z.object({
  productId: z.string().optional(),
  sku: z.string(),
  stock: z.number().int().min(0),
  timestamp: z.number(),
});

type ProductUpdateMessage = z.infer<typeof productUpdateMessageSchema>;
type PriceUpdateMessage = z.infer<typeof priceUpdateMessageSchema>;
type StockUpdateMessage = z.infer<typeof stockUpdateMessageSchema>;

// Kafka client setup
const kafka = new Kafka({
  clientId: env.KAFKA_CLIENT_ID,
  brokers: [env.KAFKA_BROKER],
  sasl: env.KAFKA_USERNAME && env.KAFKA_PASSWORD ? {
    mechanism: 'plain',
    username: env.KAFKA_USERNAME,
    password: env.KAFKA_PASSWORD,
  } : undefined,
  ssl: env.NODE_ENV === 'production',
  retry: {
    initialRetryTime: 300,
    retries: 5,
  },
});

// HTTP client for backend API
const apiClient = axios.create({
  baseURL: env.BACKEND_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  backoffMultiplier: 2,
};

// Retry utility function
async function withRetry<T>(
  operation: () => Promise<T>,
  retries = RETRY_CONFIG.maxRetries,
  delay = RETRY_CONFIG.retryDelay
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (retries > 0) {
      logger.warn(`Operation failed, retrying in ${delay}ms. Retries left: ${retries}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(operation, retries - 1, delay * RETRY_CONFIG.backoffMultiplier);
    }
    throw error;
  }
}

// Message processors
class MessageProcessor {
  async processProductUpdate(message: ProductUpdateMessage): Promise<void> {
    logger.info('Processing product update', { sku: message.sku, id: message.id });

    await withRetry(async () => {
      // Find product by ID or SKU
      let productId = message.id;

      if (!productId && message.sku) {
        try {
          const response = await apiClient.get(`/api/products/sku/${message.sku}`);
          productId = response.data.data.product.id;
        } catch (error) {
          if (axios.isAxiosError(error) && error.response?.status === 404) {
            logger.error(`Product not found for SKU: ${message.sku}`);
            return;
          }
          throw error;
        }
      }

      if (!productId) {
        logger.error('No product ID or SKU provided in message');
        return;
      }

      // Update product
      const updateData: any = {};
      if (message.name) updateData.name = message.name;
      if (message.description) updateData.description = message.description;
      if (message.category) updateData.category = message.category;
      if (message.brand) updateData.brand = message.brand;
      if (message.weight) updateData.weight = message.weight;
      if (message.unit) updateData.unit = message.unit;
      if (typeof message.isActive === 'boolean') updateData.isActive = message.isActive;

      await apiClient.put(`/api/products/${productId}`, updateData);
      logger.info(`Product updated successfully: ${productId}`);
    });
  }

  async processPriceUpdate(message: PriceUpdateMessage): Promise<void> {
    logger.info('Processing price update', { sku: message.sku, price: message.price });

    await withRetry(async () => {
      let productId = message.productId;

      if (!productId) {
        try {
          const response = await apiClient.get(`/api/products/sku/${message.sku}`);
          productId = response.data.data.product.id;
        } catch (error) {
          if (axios.isAxiosError(error) && error.response?.status === 404) {
            logger.error(`Product not found for SKU: ${message.sku}`);
            return;
          }
          throw error;
        }
      }

      await apiClient.put(`/api/products/${productId}`, {
        price: message.price,
      });
      logger.info(`Price updated successfully: ${productId} - $${message.price}`);
    });
  }

  async processStockUpdate(message: StockUpdateMessage): Promise<void> {
    logger.info('Processing stock update', { sku: message.sku, stock: message.stock });

    await withRetry(async () => {
      let productId = message.productId;

      if (!productId) {
        try {
          const response = await apiClient.get(`/api/products/sku/${message.sku}`);
          productId = response.data.data.product.id;
        } catch (error) {
          if (axios.isAxiosError(error) && error.response?.status === 404) {
            logger.error(`Product not found for SKU: ${message.sku}`);
            return;
          }
          throw error;
        }
      }

      await apiClient.put(`/api/products/${productId}`, {
        stock: message.stock,
      });
      logger.info(`Stock updated successfully: ${productId} - ${message.stock} units`);
    });
  }
}

// Main worker class
class ERPSyncWorker {
  private consumer: Consumer;
  private processor: MessageProcessor;
  private isRunning = false;

  constructor() {
    this.consumer = kafka.consumer({ 
      groupId: env.KAFKA_GROUP_ID,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });
    this.processor = new MessageProcessor();
  }

  async start(): Promise<void> {
    try {
      await this.consumer.connect();
      logger.info('Kafka consumer connected');

      // Subscribe to topics
      await this.consumer.subscribe({
        topics: Object.values(TOPICS),
        fromBeginning: false,
      });

      logger.info('Subscribed to topics:', Object.values(TOPICS));

      // Start consuming messages
      await this.consumer.run({
        eachMessage: this.handleMessage.bind(this),
        partitionsConsumedConcurrently: 3,
      });

      this.isRunning = true;
      logger.info('ERP Sync Worker started successfully');
    } catch (error) {
      logger.error('Failed to start ERP Sync Worker:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.isRunning = false;
      await this.consumer.disconnect();
      logger.info('ERP Sync Worker stopped');
    } catch (error) {
      logger.error('Error stopping ERP Sync Worker:', error);
      throw error;
    }
  }

  private async handleMessage({ topic, partition, message }: EachMessagePayload): Promise<void> {
    try {
      const messageValue = message.value?.toString();
      if (!messageValue) {
        logger.warn('Received empty message', { topic, partition });
        return;
      }

      const data = JSON.parse(messageValue);
      logger.debug('Received message', { topic, partition, data });

      switch (topic) {
        case TOPICS.PRODUCT_UPDATES:
          const productUpdate = productUpdateMessageSchema.parse(data);
          await this.processor.processProductUpdate(productUpdate);
          break;

        case TOPICS.PRICE_UPDATES:
          const priceUpdate = priceUpdateMessageSchema.parse(data);
          await this.processor.processPriceUpdate(priceUpdate);
          break;

        case TOPICS.STOCK_UPDATES:
          const stockUpdate = stockUpdateMessageSchema.parse(data);
          await this.processor.processStockUpdate(stockUpdate);
          break;

        default:
          logger.warn(`Unknown topic: ${topic}`);
      }
    } catch (error) {
      logger.error('Error processing message:', {
        error: error instanceof Error ? error.message : error,
        topic,
        partition,
        offset: message.offset,
      });
      
      // In production, you might want to send failed messages to a dead letter queue
      // For now, we'll just log the error and continue
    }
  }
}

// Graceful shutdown handling
const worker = new ERPSyncWorker();

const gracefulShutdown = async () => {
  logger.info('Received shutdown signal, stopping worker...');
  await worker.stop();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the worker
if (require.main === module) {
  worker.start().catch((error) => {
    logger.error('Failed to start worker:', error);
    process.exit(1);
  });
}

export { ERPSyncWorker };