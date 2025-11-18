import { Kafka, Consumer, Producer } from 'kafkajs';
import { env } from './env';
import { logger } from '../utils/logger';

// Kafka client configuration
const kafka = new Kafka({
  clientId: env.KAFKA_CLIENT_ID,
  brokers: [env.KAFKA_BROKER],
  sasl: env.KAFKA_USERNAME && env.KAFKA_PASSWORD ? {
    mechanism: 'plain',
    username: env.KAFKA_USERNAME,
    password: env.KAFKA_PASSWORD,
  } : undefined,
  ssl: env.NODE_ENV === 'production',
  connectionTimeout: 3000,
  requestTimeout: 30000,
});

// Topics configuration
export const KAFKA_TOPICS = {
  PRODUCT_UPDATES: 'product_updates',
  PRICE_UPDATES: 'price_updates',
  STOCK_UPDATES: 'stock_updates',
  ORDER_EVENTS: 'order_events',
  USER_EVENTS: 'user_events',
} as const;

// Message types
export interface ProductUpdateMessage {
  id: string;
  name?: string;
  sku?: string;
  description?: string;
  category?: string;
  brand?: string;
  weight?: number;
  unit?: string;
  isActive?: boolean;
  timestamp: number;
}

export interface PriceUpdateMessage {
  productId: string;
  sku: string;
  price: number;
  timestamp: number;
}

export interface StockUpdateMessage {
  productId: string;
  sku: string;
  stock: number;
  timestamp: number;
}

export interface OrderEventMessage {
  orderId: string;
  userId: string;
  status: string;
  total: number;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  timestamp: number;
}

// Create consumer
export const createKafkaConsumer = (groupId: string): Consumer => {
  return kafka.consumer({ 
    groupId,
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
  });
};

// Create producer
export const createKafkaProducer = (): Producer => {
  return kafka.producer({
    maxInFlightRequests: 1,
    idempotent: true,
    transactionTimeout: 30000,
  });
};

// Producer utility functions
export class KafkaProducerService {
  private producer: Producer;
  private isConnected = false;

  constructor() {
    this.producer = createKafkaProducer();
  }

  async connect(): Promise<void> {
    try {
      await this.producer.connect();
      this.isConnected = true;
      logger.info('Kafka producer connected');
    } catch (error) {
      logger.error('Failed to connect Kafka producer:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.producer.disconnect();
      this.isConnected = false;
      logger.info('Kafka producer disconnected');
    } catch (error) {
      logger.error('Failed to disconnect Kafka producer:', error);
    }
  }

  async sendOrderEvent(message: OrderEventMessage): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      await this.producer.send({
        topic: KAFKA_TOPICS.ORDER_EVENTS,
        messages: [{
          key: message.orderId,
          value: JSON.stringify(message),
          timestamp: message.timestamp.toString(),
        }],
      });
      logger.info(`Order event sent: ${message.orderId}`);
    } catch (error) {
      logger.error('Failed to send order event:', error);
      throw error;
    }
  }

  async sendUserEvent(userId: string, event: string, data: any): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const message = {
        userId,
        event,
        data,
        timestamp: Date.now(),
      };

      await this.producer.send({
        topic: KAFKA_TOPICS.USER_EVENTS,
        messages: [{
          key: userId,
          value: JSON.stringify(message),
          timestamp: message.timestamp.toString(),
        }],
      });
      logger.info(`User event sent: ${userId} - ${event}`);
    } catch (error) {
      logger.error('Failed to send user event:', error);
      throw error;
    }
  }
}

export const kafkaProducer = new KafkaProducerService();