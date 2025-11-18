# Members-Only Grocery E-Commerce Platform

A full-stack e-commerce web application built with Next.js 14, Node.js/Express, PostgreSQL, and Redis.

## 🚀 Features

- **Members-only access**: Product browsing requires authentication
- **Admin approval system**: New registrations need admin approval
- **Real-time ERP sync**: Kafka integration for product/price/stock updates
- **PWA-ready**: Progressive Web App capabilities
- **Fast & lightweight**: Optimized performance with caching
- **Analytics-ready**: Built for tracking and monitoring

## 🛠 Tech Stack

### Frontend
- Next.js 14 (App Router, Server Components)
- React 18
- TypeScript
- TailwindCSS
- NextAuth.js
- Axios/SWR
- PWA support

### Backend
- Node.js + Express
- PostgreSQL (Neon/Supabase compatible)
- Prisma ORM
- Redis (Upstash)
- JWT Authentication
- Kafka Consumer
- Cloudflare R2 (S3-compatible storage)
- Zod validation

## 📁 Project Structure

```
/
├── backend/          # Express API server
├── frontend/         # Next.js application
├── worker-kafka-sync/# Kafka consumer worker
├── .env.example      # Environment variables template
└── README.md         # This file
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Redis instance
- Kafka broker
- Cloudflare R2 bucket

### 1. Environment Setup
```bash
cp .env.example .env
# Fill in your environment variables
```

### 2. Backend Setup
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 4. Kafka Worker Setup
```bash
cd worker-kafka-sync
npm install
npm run dev
```

## 🌐 Deployment

### Frontend (Vercel)
1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main

### Backend (Railway/Render)
1. Connect repository to Railway or Render
2. Set environment variables
3. Configure build and start commands:
   - Build: `npm install && npx prisma generate`
   - Start: `npm start`

### Database
- Use Neon, Supabase, or any PostgreSQL provider
- Run migrations: `npx prisma db push`

### Redis
- Use Upstash Redis or any Redis provider
- Configure connection URL in environment

### Kafka Worker
- Deploy as separate service on Railway/Render
- Ensure Kafka broker is accessible

## 📊 Database Schema

- **Users**: Authentication and role management
- **Products**: SKU, pricing, inventory
- **Orders**: Purchase tracking

## 🔐 Authentication Flow

1. User registers (status: PENDING)
2. Admin approves/denies registration
3. Approved users can login and browse products
4. JWT tokens stored in HTTP-only cookies

## 🛒 Key Features

### Product Management
- Admin CRUD operations
- Real-time ERP synchronization via Kafka
- Redis caching for performance
- Image storage on Cloudflare R2

### User Management
- Role-based access (ADMIN, MEMBER, PENDING)
- Admin approval workflow
- JWT-based authentication

### Performance
- ISR caching for product pages
- Redis caching for API responses
- Optimized server components

## 📱 PWA Features

- Offline capability
- Install prompt
- App-like experience
- Fast loading with caching

## 🔧 API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout

### Products (Protected)
- `GET /products` - List products
- `GET /products/:id` - Get product details
- `POST /products` - Create product (admin)
- `PUT /products/:id` - Update product (admin)

### Admin
- `GET /admin/users` - List pending users
- `POST /admin/users/:id/approve` - Approve user
- `POST /admin/users/:id/deny` - Deny user

## 🎯 Environment Variables

See `.env.example` for required environment variables.

## 🐛 Development

### Running Tests
```bash
npm test
```

### Database Migrations
```bash
npx prisma studio  # Database GUI
npx prisma db push # Push schema changes
```

### Monitoring
- Check Redis cache status
- Monitor Kafka consumer logs
- Database query performance

## 📝 License

MIT License - see LICENSE file for details.