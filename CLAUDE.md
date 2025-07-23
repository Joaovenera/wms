# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a warehouse management system (WMS) with a separated frontend/backend architecture:

- **`backend/`** - Express.js API server with PostgreSQL database (via Drizzle ORM)
- **`frontend/`** - React/Vite client with TypeScript and Tailwind CSS

## Development Commands

### Backend (Express API)
```bash
cd backend
npm run dev          # Start development server with tsx watch
npm run build        # TypeScript compilation + esbuild bundle
npm run start        # Production server
npm run check        # TypeScript type checking
npm run db:push      # Push schema changes to database
npm run db:generate  # Generate Drizzle migrations
npm run db:migrate   # Run database migrations
```

### Frontend (React/Vite)
```bash
cd frontend
npm run dev          # Start development server
npm run dev:https    # Start with HTTPS (camera features)
npm run build        # TypeScript + Vite production build
npm run lint         # ESLint check
npm run check        # TypeScript type checking
npm test             # Vitest test runner
npm run test:ui      # Vitest UI interface
npm run test:run     # Run tests once
npm run test:coverage # Run tests with coverage
```

## Key Architecture Patterns

### Database Layer
- Uses **Drizzle ORM** with PostgreSQL
- Schema definitions in `backend/src/db/schema.ts`
- Core entities: users, pallets, positions, structures, UCPs (Unit Container Pallets), products
- Supports item transfers between UCPs with tracking

### API Layer
- RESTful API with Express.js
- Authentication via Passport.js with session management
- Comprehensive logging with Winston (see `backend/docs/LOGGER.md`)
- Rate limiting and CORS configured
- Redis for session storage and caching

### Frontend Architecture
- React 18 with TypeScript
- **TanStack Query** for server state management
- **Wouter** for client-side routing
- **Radix UI** + **Tailwind CSS** for UI components
- **Framer Motion** for animations
- Camera capture support for QR code scanning

### Key Business Logic
- **Pallet Management**: Physical pallet tracking with status lifecycle
- **Position Management**: Warehouse location system with coordinates
- **UCP System**: Container units that can hold multiple items
- **Item Transfers**: Track movement of items between UCPs
- **Real-time Updates**: WebSocket support for warehouse activity

## Testing Strategy

### Frontend Tests (Vitest + Testing Library)
- Test configuration in `frontend/vitest.config.ts`
- Mock Service Worker (MSW) for API mocking
- Comprehensive test suite in `frontend/src/test/`
- Run working tests: `npm test simple-pallets.test.tsx --run`
- API tests: `npm test api/pallets.test.ts --run`

### React Query Configuration
- When testing components with useQuery, ensure proper QueryClient setup
- Use MSW handlers in `frontend/src/test/mocks/handlers.ts`
- Wrap components with QueryClientProvider in tests

## Common Development Workflows

### Adding New API Endpoints
1. Define route in `backend/src/routes.ts`
2. Add schema validation using Zod
3. Update database schema in `backend/src/db/schema.ts` if needed
4. Run `npm run db:generate && npm run db:push` to apply changes

### Adding New Frontend Features
1. Create components in `frontend/src/components/`
2. Add types in `frontend/src/types/schemas.ts`
3. Use TanStack Query for data fetching
4. Follow existing UI patterns with Radix + Tailwind

### Database Changes
1. Modify schema in `backend/src/db/schema.ts`
2. Generate migration: `npm run db:generate`
3. Apply to database: `npm run db:push`
4. Update frontend types in `frontend/src/types/schemas.ts`

## Security & Performance Notes

- Camera features require HTTPS: use `npm run dev:https` in frontend
- Authentication sessions stored in Redis
- Rate limiting configured for API endpoints
- Images and file uploads handled with proper validation
- Real-time warehouse map updates via WebSocket

## Environment Setup

- Backend requires PostgreSQL database and Redis
- Frontend can run standalone for UI development
- Docker setup available with `backend/docker-compose.yml`
- SSL certificates in both `backend/certs/` and `frontend/certs/` for HTTPS development