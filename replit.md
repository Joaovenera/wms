# MWS - Mobile Warehouse System

## Overview

MWS is a mobile-first warehouse management system designed for real-time inventory control. The application features a dual interface architecture: optimized mobile views for warehouse operators in the field and comprehensive desktop administration for management tasks. The system integrates QR code scanning, real-time data synchronization, and comprehensive inventory tracking capabilities.

## System Architecture

### Monorepo Structure
- **Frontend**: React with TypeScript in `client/` directory
- **Backend**: Express.js server in `server/` directory  
- **Shared**: Common schemas and types in `shared/` directory
- **Database**: PostgreSQL with Drizzle ORM for migrations and queries

### Technology Stack
- **Frontend**: React, TypeScript, Vite, TanStack Query, Wouter (routing)
- **UI Framework**: shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with custom warehouse-themed design system
- **Backend**: Express.js with TypeScript, Passport.js for authentication
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Replit Auth with OpenID Connect
- **Build Tools**: Vite for frontend bundling, esbuild for backend compilation

## Key Components

### Frontend Architecture
- **Responsive Design**: Automatically switches between mobile and desktop layouts based on screen size
- **Mobile Views**: Touch-optimized interfaces for field operations (QR scanning, quick actions)
- **Desktop Views**: Full-featured admin panels for comprehensive management
- **State Management**: TanStack Query for server state, React Context for UI state
- **Navigation**: Wouter for lightweight client-side routing

### Backend Architecture
- **RESTful API**: Express.js server with structured route handling
- **Authentication Middleware**: Session-based auth with Replit integration
- **Database Layer**: Drizzle ORM with PostgreSQL for type-safe database operations
- **Error Handling**: Centralized error handling with proper HTTP status codes
- **Logging**: Request/response logging with performance metrics

### Database Schema
Core entities include:
- **Users**: Authentication and role management (admin/operator)
- **Pallets**: Physical pallet specifications and status tracking
- **Positions**: Warehouse location hierarchy (street/side/corridor/level)
- **Products**: Item master data with inventory rules
- **UCPs**: Unit Control Pallets - containers for products on specific pallets
- **Movements**: Audit trail for all inventory transactions
- **Sessions**: Server-side session storage for authentication

## Data Flow

### Mobile Operations
1. Operator scans QR code via mobile camera interface
2. System identifies entity type (pallet, position, UCP, product)
3. Real-time validation and business rule enforcement
4. Immediate UI feedback and transaction logging
5. Automatic synchronization across all connected clients

### Desktop Administration  
1. Management accesses comprehensive admin interfaces
2. CRUD operations on master data (pallets, positions, products)
3. Dashboard analytics with real-time warehouse metrics
4. Advanced reporting and warehouse visualization
5. User management and system configuration

### Authentication Flow
1. Replit Auth integration with OpenID Connect
2. Session management with PostgreSQL storage
3. Role-based access control (admin vs operator permissions)
4. Automatic session refresh and secure logout

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL connection pooling for serverless environments
- **drizzle-orm & drizzle-kit**: Type-safe ORM and database migration tools
- **@tanstack/react-query**: Server state management and caching
- **@radix-ui/**: Accessible UI component primitives
- **passport & openid-client**: Authentication and OIDC integration

### Development Dependencies
- **tsx**: TypeScript execution for development server
- **vite**: Frontend build tool and development server
- **esbuild**: Backend bundling for production

### Replit-Specific Integrations
- **@replit/vite-plugin-runtime-error-modal**: Enhanced error reporting in development
- **@replit/vite-plugin-cartographer**: Development tooling integration

## Deployment Strategy

### Development Environment
- Hot module replacement via Vite for frontend changes
- TypeScript compilation with tsx for backend development
- PostgreSQL provisioned through Replit's database service
- Environment variables managed through Replit secrets

### Production Build
1. Frontend assets built and optimized via Vite
2. Backend compiled to ESM bundle with esbuild
3. Static assets served from Express with fallback routing
4. Database migrations applied via Drizzle Kit
5. Session storage configured for production scaling

### Scaling Considerations
- Autoscale deployment target configured in Replit
- Connection pooling for database efficiency
- Static asset optimization and caching
- Session storage distributed across instances

## Changelog
- June 23, 2025. Initial setup
- June 23, 2025. Database schema corrected - fixed session index conflict, updated user table with proper serial ID and password field, restored foreign key relationships
- June 23, 2025. Implemented comprehensive automatic refresh system:
  * Added automatic data refresh when filter criteria change (300ms debounce)
  * Added Enter key trigger for immediate refresh in search fields
  * Added manual refresh buttons with loading states
  * Enhanced queryClient with 30-second polling for real-time updates
  * Consistent implementation across desktop and mobile interfaces
- June 23, 2025. Enhanced dashboard with advanced visual improvements:
  * Implemented automatic sequential pallet code generation (PLT0001, PLT0002, etc.)
  * Added animated status cards with gradients, hover effects, and progress bars
  * Created custom CSS animations (fadeInUp, countUp, bounce, fillProgress)
  * Added icon-based status indicators with emojis for better visual recognition
  * Implemented staggered animation delays for smooth loading experience
  * Enhanced KPI cards with gradient overlays and interactive hover states
- June 23, 2025. Implemented PP-RUA-POSIÇÃO-NÍVEL addressing system for porta-pallets:
  * Created new addressing format PP-01-01-0 (PortaPallet-Street-Position-Level)
  * Added automatic side calculation (even positions=right, odd positions=left)
  * Implemented visual pallet layout configurator with graphical representation
  * Added support for 1-2 pallets per position with optional central division
  * Complete desktop interface with data table, filters, and visual mini-previews
  * Updated database schema with position, level (integer), has_division, and layout_config fields
- June 23, 2025. Fixed porta-pallets form submission issues:
  * Corrected apiRequest parameter order in create and delete operations
  * Fixed form validation schema and field typing issues
  * Implemented functional create/delete operations for pallet structures
  * Automatic position generation working correctly with PP-RUA-POSIÇÃO-NÍVEL format
  * Form now properly validates and submits with proper error handling
- June 23, 2025. Simplified positions page with modern, intuitive interface:
  * Removed complex PalletLayoutConfigurator component for cleaner UX
  * Implemented automatic code generation (PP-RUA-POSIÇÃO-NÍVEL format)
  * Added automatic side detection (even positions=right, odd positions=left)
  * Created modern card-based layout with visual status indicators
  * Added comprehensive filtering (search, status, street) and real-time refresh
  * Improved form validation with instant feedback and field dependencies
- June 23, 2025. Completely redesigned Mapa do Armazém with modern interactive interface:
  * Added animated warehouse visualization with emojis and color-coded status indicators
  * Implemented hover effects and interactive position cards with smooth animations
  * Created compact and detailed view modes with toggle buttons
  * Added street-based grouping with filter functionality for better navigation
  * Implemented real-time statistics cards and comprehensive status legend
  * Added bounceIn and fadeInUp animations for enhanced user experience
  * Created responsive grid layout with gradient backgrounds and shadow effects
  * Optimized layout compactness: reduced position size (60px minimum), smaller gaps (1px), reduced padding and margins throughout
  * Enhanced position density with better space utilization and responsive scaling
- June 23, 2025. Implemented realistic porta-pallet visualization with physical structure representation:
  * Created 3D-like porta-pallet structures showing metallic framework with pillars and shelves
  * Added corridor visualization with central aisle between left and right sides
  * Implemented level-based organization showing actual shelf structure from top to bottom
  * Added realistic coloring (slate framework, colored status indicators) and shadows
  * Created position grouping by physical location with proper level stacking
  * Added structural details like connecting bars, base platform, and position labels

## User Preferences

Preferred communication style: Simple, everyday language.