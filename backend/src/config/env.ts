import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  // Server
  PORT: z.string().default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Database
  DATABASE_URL: z.string(),
  
  // Redis
  REDIS_URL: z.string(),
  
  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  
  // Cloudflare R2
  CLOUDFLARE_R2_ENDPOINT: z.string(),
  CLOUDFLARE_R2_ACCESS_KEY_ID: z.string(),
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: z.string(),
  CLOUDFLARE_R2_BUCKET_NAME: z.string(),
  
  // Kafka
  KAFKA_BROKER: z.string(),
  KAFKA_USERNAME: z.string().optional(),
  KAFKA_PASSWORD: z.string().optional(),
  KAFKA_CLIENT_ID: z.string().default('grocery-backend'),
  
  // Admin
  ADMIN_EMAIL: z.string().email().default('admin@grocery.com'),
  ADMIN_PASSWORD: z.string().min(6).default('admin123'),
  
  // CORS
  FRONTEND_URL: z.string().default('http://localhost:3000'),
});

export const env = envSchema.parse(process.env);

export type Environment = z.infer<typeof envSchema>;