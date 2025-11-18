# Deployment Guide

This guide will walk you through deploying the Members-Only Grocery E-Commerce Platform to production.

## Prerequisites

- Node.js 18+ installed locally
- Docker (for containerized deployment)
- PostgreSQL database (Neon, Supabase, or self-hosted)
- Redis instance (Upstash or self-hosted)
- Cloudflare R2 bucket
- Kafka broker (Confluent Cloud or self-hosted)
- Domain name and SSL certificate

## Environment Variables

Copy `.env.example` to `.env` and configure all variables:

```bash
cp .env.example .env
```

### Required Environment Variables

```bash
# Database
DATABASE_URL="postgresql://username:password@host:5432/database"

# Redis
REDIS_URL="redis://username:password@host:6379"

# JWT
JWT_SECRET="your-super-secure-jwt-secret-key"
JWT_EXPIRES_IN="7d"

# Cloudflare R2
CLOUDFLARE_R2_ENDPOINT="https://account-id.r2.cloudflarestorage.com"
CLOUDFLARE_R2_ACCESS_KEY_ID="your-access-key"
CLOUDFLARE_R2_SECRET_ACCESS_KEY="your-secret-key"
CLOUDFLARE_R2_BUCKET_NAME="grocery-images"

# NextAuth
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="https://yourdomain.com"

# Backend
BACKEND_URL="https://api.yourdomain.com"

# Kafka
KAFKA_BROKER="your-kafka-broker:9092"
KAFKA_USERNAME="your-kafka-username"
KAFKA_PASSWORD="your-kafka-password"

# Frontend
NEXT_PUBLIC_BACKEND_URL="https://api.yourdomain.com"
```

## Deployment Options

### Option 1: Cloud Platform Deployment (Recommended)

#### Frontend (Vercel)

1. **Connect Repository**
   ```bash
   # Push your code to GitHub
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Set environment variables in Vercel dashboard
   - Deploy automatically

3. **Configure Domain**
   - Add your custom domain in Vercel settings
   - Update `NEXTAUTH_URL` environment variable

#### Backend (Railway/Render)

1. **Railway Deployment**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli

   # Login and deploy
   railway login
   railway init
   railway up
   ```

2. **Environment Variables**
   - Set all required environment variables in Railway dashboard
   - Ensure `PORT` is set to the port Railway provides

3. **Database Migration**
   ```bash
   # Run migrations after deployment
   railway run npx prisma db push
   ```

#### Kafka Worker (Railway/Render)

1. **Deploy Worker**
   ```bash
   cd worker-kafka-sync
   # Deploy as separate service
   railway init
   railway up
   ```

### Option 2: Docker Deployment

#### Build Images

```bash
# Backend
cd backend
docker build -t grocery-backend .

# Frontend
cd frontend
docker build -t grocery-frontend .

# Kafka Worker
cd worker-kafka-sync
docker build -t grocery-worker .
```

#### Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'
services:
  backend:
    image: grocery-backend
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - redis

  frontend:
    image: grocery-frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_BACKEND_URL=${BACKEND_URL}
      - NEXTAUTH_URL=${NEXTAUTH_URL}

  worker:
    image: grocery-worker
    environment:
      - KAFKA_BROKER=${KAFKA_BROKER}
      - BACKEND_URL=${BACKEND_URL}

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

#### Run with Docker Compose

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Option 3: VPS/Server Deployment

#### Setup Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt install nginx
```

#### Deploy Backend

```bash
# Clone repository
git clone your-repo-url
cd grocery-ecommerce/backend

# Install dependencies
npm install

# Build application
npm run build

# Setup database
npx prisma generate
npx prisma db push

# Start with PM2
pm2 start dist/index.js --name grocery-backend
```

#### Deploy Frontend

```bash
cd ../frontend
npm install
npm run build

# Start with PM2
pm2 start npm --name grocery-frontend -- start
```

#### Configure Nginx

```nginx
# /etc/nginx/sites-available/grocery
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/grocery /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### SSL with Certbot

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com
```

## Database Setup

### PostgreSQL (Neon/Supabase)

1. **Create Database**
   - Sign up for Neon or Supabase
   - Create a new project
   - Copy the connection string

2. **Run Migrations**
   ```bash
   cd backend
   npx prisma generate
   npx prisma db push
   ```

3. **Create Admin User**
   ```bash
   # Run the seed script
   npm run seed
   ```

### Redis (Upstash)

1. **Create Redis Instance**
   - Sign up for Upstash
   - Create a new Redis database
   - Copy the connection URL

## External Services Setup

### Cloudflare R2

1. **Create Bucket**
   - Go to Cloudflare dashboard
   - Navigate to R2 Object Storage
   - Create a new bucket named "grocery-images"

2. **Create API Token**
   - Generate API token with R2 permissions
   - Note the access key and secret

3. **Configure CORS**
   ```json
   [
     {
       "AllowedOrigins": ["https://yourdomain.com"],
       "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
       "AllowedHeaders": ["*"]
     }
   ]
   ```

### Kafka Setup

#### Option 1: Confluent Cloud

1. **Create Cluster**
   - Sign up for Confluent Cloud
   - Create a new cluster
   - Create topics: `product_updates`, `price_updates`, `stock_updates`

2. **Create API Key**
   - Generate API key and secret
   - Configure in environment variables

#### Option 2: Self-hosted Kafka

```bash
# Using Docker
docker run -d --name kafka \
  -p 9092:9092 \
  -e KAFKA_ZOOKEEPER_CONNECT=zookeeper:2181 \
  -e KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9092 \
  -e KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1 \
  confluentinc/cp-kafka
```

## Monitoring and Logging

### PM2 Monitoring

```bash
# Monitor applications
pm2 monit

# View logs
pm2 logs

# Save PM2 configuration
pm2 save
pm2 startup
```

### Health Checks

Set up health check endpoints:

- Backend: `https://api.yourdomain.com/health`
- Frontend: `https://yourdomain.com/api/health`

### Log Management

```bash
# Configure log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

## Security Checklist

- [ ] SSL certificates installed
- [ ] Environment variables secured
- [ ] Database credentials secured
- [ ] Firewall configured
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Security headers implemented
- [ ] Input validation in place
- [ ] Authentication working
- [ ] File upload restrictions

## Backup Strategy

### Database Backup

```bash
# Automated backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > backup_$DATE.sql
```

### File Backup

Configure Cloudflare R2 bucket versioning and lifecycle rules.

## Post-Deployment

1. **Test All Features**
   - User registration and approval
   - Product browsing and search
   - Cart functionality
   - Admin dashboard
   - Image uploads
   - Kafka worker

2. **Performance Optimization**
   - Enable CDN
   - Configure caching
   - Optimize images
   - Monitor performance

3. **Setup Monitoring**
   - Application performance monitoring
   - Error tracking
   - Uptime monitoring
   - Log aggregation

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   ```bash
   # Check connection string format
   # Ensure database is accessible
   # Verify credentials
   ```

2. **Redis Connection Error**
   ```bash
   # Check Redis URL
   # Verify Redis instance is running
   # Check network connectivity
   ```

3. **Image Upload Issues**
   ```bash
   # Verify R2 credentials
   # Check bucket permissions
   # Verify CORS configuration
   ```

4. **Kafka Connection Error**
   ```bash
   # Check Kafka broker connectivity
   # Verify credentials
   # Ensure topics exist
   ```

## Scaling Considerations

### Horizontal Scaling

- Use load balancers for multiple backend instances
- Implement Redis clustering
- Use Kafka partitioning
- CDN for static assets

### Database Scaling

- Read replicas for PostgreSQL
- Connection pooling
- Query optimization
- Caching strategies

### Monitoring Scaling

- Implement metrics collection
- Set up alerting
- Capacity planning
- Performance monitoring

For additional support, refer to the main README.md file or contact the development team.