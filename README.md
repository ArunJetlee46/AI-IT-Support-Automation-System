# AI-Powered IT Help Desk Ticket Management System

A modern, intelligent IT Support Ticket Management System that automatically categorizes and routes support requests using AI. Serves both internal employees and external customers.

## 🎯 Project Overview

This is a full-stack application built with:
- **Frontend**: React 18 + TypeScript + Tailwind CSS + React Router
- **Backend**: Node.js + Express.js + TypeScript
- **Database**: PostgreSQL
- **AI**: OpenAI GPT API for ticket categorization
- **Authentication**: JWT-based auth with bcryptjs

## 📋 Features

### MVP (Phase 1-5)
- ✅ User registration & authentication (internal + external)
- ✅ Ticket management (CRUD operations)
- ✅ AI-powered auto-categorization with priority assignment
- ✅ Comment system with internal/external visibility
- ✅ File attachments support
- ✅ Email notifications
- ✅ Role-based access control (admin, agent, user)

### Phase 6-9 (In Development)
- Frontend ticket portal with filtering & search
- Admin dashboard with analytics
- Advanced security hardening
- Comprehensive testing

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 12+
- npm or yarn

### Environment Setup

1. **Backend (.env)**
```bash
cd backend
cp .env.example .env
# Update DATABASE_URL, JWT_SECRET, OPENAI_API_KEY, etc.
```

2. **Frontend (.env)**
```bash
cd frontend
cp .env.example .env
# Update VITE_API_BASE_URL if needed
```

### Installation

```bash
# Backend setup
cd backend
npm install
npm run build

# Frontend setup
cd frontend
npm install
npm run build
```

### Running Locally

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
# Server runs on http://localhost:5000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# App runs on http://localhost:5173
```

## 📁 Project Structure

```
.
├── backend/
│   ├── src/
│   │   ├── config/          # Database & schema config
│   │   ├── middleware/      # Auth & error handling
│   │   ├── routes/          # API endpoints
│   │   ├── services/        # Business logic (AI, email, etc.)
│   │   ├── utils/           # Helper functions
│   │   └── server.ts        # Express app entry
│   ├── .env.example
│   ├── tsconfig.json
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── api/             # API client & endpoints
│   │   ├── components/      # Reusable components
│   │   ├── contexts/        # React contexts (Auth, etc.)
│   │   ├── pages/           # Page components
│   │   ├── types/           # TypeScript types
│   │   ├── utils/           # Utility functions
│   │   ├── App.tsx          # Main app with router
│   │   └── main.tsx         # Entry point
│   ├── .env.example
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── package.json
│
├── .gitignore
└── README.md
```

## �� Security Features

- Password hashing with bcryptjs (cost 10+)
- JWT tokens with 24-hour expiration
- CORS properly configured
- Input validation on all endpoints
- SQL injection prevention (parameterized queries)
- XSS protection (input sanitization)
- Rate limiting (100 requests/15min per IP)
- File upload validation (whitelist, max 10MB)
- HTTPS only enforcement
- Environment variables for secrets

## 📊 Database Schema

### Users
- id (UUID)
- email (unique)
- password (hashed)
- name
- role (admin, agent, user)
- user_type (internal, external)
- phone, department
- timestamps

### Tickets
- id (TKT-XXXX format)
- title, description
- category, priority, status
- AI-generated summary
- user_id, assigned_to
- timestamps, resolved_at
- ai_categorization_confidence

### Attachments
- id (UUID)
- ticket_id, filename, file_path
- file_size, uploaded_by
- timestamps

### Ticket Comments
- id (UUID)
- ticket_id, user_id
- comment_text
- is_internal (visibility flag)
- timestamps

### Ticket Status History
- id (UUID)
- ticket_id, old_status, new_status
- changed_by, changed_at

## 🔄 AI Categorization

The system automatically analyzes ticket title + description and returns:
```json
{
  "category": "Hardware Issues",
  "priority": "High",
  "summary": "User cannot connect to VPN. Network adapter drivers need update."
}
```

**Categories**: Hardware Issues, Software Installation, Network & Connectivity, Account & Access, Email & Communication, Security & Compliance, Data & Backup, Performance Issues, Other

**Priorities**: Critical, High, Medium, Low

## 📧 Email Notifications

Triggers:
- ✉️ Ticket creation confirmation
- ✉️ Status change notifications
- ✉️ Assignment notifications
- ✉️ Comment notifications

## 📈 Performance Targets

- API response time < 200ms (p95)
- Page load time < 2 seconds (FCP)
- Database queries with proper indexing
- Pagination (max 50 items/page)
- Response compression (gzip)
- Lazy loading on frontend

## 🛠️ Development

### Available Scripts

**Backend:**
```bash
npm run dev      # Run with hot reload
npm run build    # Compile TypeScript
npm start        # Run compiled app
npm test         # Run tests
```

**Frontend:**
```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## 📝 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Tickets
- `POST /api/tickets` - Create ticket
- `GET /api/tickets` - List tickets (with filters)
- `GET /api/tickets/:id` - Get ticket detail
- `PATCH /api/tickets/:id` - Update ticket
- `DELETE /api/tickets/:id` - Delete ticket

### Comments
- `POST /api/tickets/:id/comments` - Add comment
- `GET /api/tickets/:id/comments` - Get comments

### Metadata
- `GET /api/categories` - List categories
- `GET /api/priorities` - List priorities
- `GET /api/statuses` - List statuses

## 🎨 Design System

**Theme**: White/Industrial with clean, minimalist design

**Colors**:
- Primary: #1f2937 (gray-900)
- Secondary: #6b7280 (gray-500)
- Success: #10b981 (green)
- Warning: #f59e0b (amber)
- Error: #ef4444 (red)
- Info: #3b82f6 (blue)

## 🧪 Testing

Tests will cover:
- Unit tests for critical functions
- API endpoint integration tests
- Authentication flow tests

## 📦 Deployment

### Production Build

```bash
# Backend
cd backend
npm run build
NODE_ENV=production npm start

# Frontend
cd frontend
npm run build
# Serve 'dist' directory with web server
```

### Environment Variables (Production)
- `NODE_ENV=production`
- `DATABASE_URL=******prod-db:5432/it_support`
- `JWT_SECRET=<strong-random-secret>`
- `OPENAI_API_KEY=<your-key>`
- `FRONTEND_URL=https://yourdomain.com`
- HTTPS enabled with valid SSL certificate

## 📚 Documentation

- [API Documentation](./docs/API.md) - Detailed endpoint specs
- [Database Schema](./docs/DATABASE.md) - Schema details
- [Setup Guide](./docs/SETUP.md) - Detailed setup instructions

## �� Contributing

1. Create a feature branch: `git checkout -b feature/feature-name`
2. Commit changes: `git commit -am 'Add feature'`
3. Push to branch: `git push origin feature/feature-name`
4. Open a Pull Request

## 📄 License

ISC

## 👨‍💻 Author

Arun Jetlee

---

**Status**: In active development (Phases 1-5 complete, Phases 6-9 in progress)

For issues and feature requests, please open an issue on GitHub.
