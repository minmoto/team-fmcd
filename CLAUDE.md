# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Start development server**: `npm run dev` (runs on http://localhost:3030)
- **Build project**: `npm run build`
- **Start production server**: `npm start`
- **Lint code**: `npm run lint`

## Architecture Overview

This is a Next.js 15 multi-tenant starter template using the App Router with Stack Auth for authentication and team management.

### Key Technologies

- **Framework**: Next.js 15 with App Router
- **Authentication**: Stack Auth (@stackframe/stack)
- **Styling**: Tailwind CSS with Shadcn UI components
- **UI Components**: Radix UI primitives with custom styling
- **Charts**: Recharts for data visualization
- **Type System**: TypeScript with strict mode

### Project Structure

- **`app/`**: Next.js App Router pages and layouts
  - `dashboard/`: Protected dashboard pages with sidebar layout
  - `(landing-page)/`: Public landing page (route group)
  - `handler/`: Stack Auth handler routes
- **`components/`**: Reusable UI components
  - `ui/`: Shadcn UI components (generated)
  - Root-level components for layout, features, etc.
- **`lib/`**: Utility functions and shared logic
- **`stack.tsx`**: Stack Auth server configuration

### Authentication & Multi-tenancy

Stack Auth handles:

- User authentication with email/password
- Team/organization management (multi-tenancy)
- Session management via Next.js cookies
- Redirects to `/dashboard` after sign-in

The sidebar layout (`components/sidebar-layout.tsx`) provides team switching and navigation for authenticated users.

### UI System

- **Design System**: Shadcn UI with "new-york" style
- **Theme**: Dark mode support via `next-themes`
- **Components**: CSS variables for theming in `app/globals.css`
- **Path Aliases**: `@/` maps to project root, `@/components` and `@/lib/utils` configured

### Environment Setup

Required environment variables (see `.env.local.example`):

- `NEXT_PUBLIC_STACK_PROJECT_ID`
- `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY`
- `STACK_SECRET_SERVER_KEY`

Get these from the Stack Auth dashboard and enable "client team creation" in team settings.

## FMCD Integration

This dashboard integrates with FMCD (Fedimint Client Daemon) instances to provide Bitcoin wallet functionality for teams.

### Key Features

- **Team-based Configuration**: Each team can configure their own FMCD instance
- **Admin Controls**: Only team administrators can modify FMCD settings (base URL and password)
- **Real-time Data**: Dashboard shows live balance, federation info, and connection status
- **Security**: All FMCD communication happens server-side with encrypted credentials

### FMCD Configuration

1. Navigate to Configuration page in team dashboard
2. Team admins can set:
   - FMCD Base URL (e.g., `http://localhost:3333`)
   - Authentication password
   - Enable/disable the integration
3. Test connection before saving
4. All team members can view the data, only admins can configure

### API Endpoints

- `/api/team/[teamId]/fmcd/config` - Configuration management (admin only)
- `/api/team/[teamId]/fmcd/test` - Connection testing (admin only)
- `/api/team/[teamId]/fmcd/info` - FMCD instance info (all team members)
- `/api/team/[teamId]/fmcd/balance` - Wallet balance (all team members)

### Components

**Configuration & Management:**

- `FMCDConfigComponent` (`/components/fmcd-config.tsx`): Admin configuration interface for FMCD settings

**Dashboard Display:**

- `FMCDStatusCards` (`/components/fmcd-status-cards.tsx`): Overview cards showing balances and federation count
- `FederationCard` (`/components/federation-card.tsx`): Reusable component for displaying individual federation details

**Pages:**

- `/dashboard/[teamId]/(overview)` - Main dashboard with status cards and summary view
- `/dashboard/[teamId]/federations` - Detailed federation management page with data fetching logic
- `/dashboard/[teamId]/configuration` - FMCD instance configuration for team admins

### Data Storage

FMCD configurations are stored using Stack Auth's `team.serverMetadata` which provides:

- Secure server-side storage of credentials
- Automatic encryption and team isolation
- No additional encryption layer needed
- Integration with Stack Auth's permission system

Storage structure:

```typescript
team.serverMetadata = {
  fmcdConfig: {
    baseUrl: string,
    password: string,
    isActive: boolean,
    createdAt: string,
    updatedAt: string,
    createdBy: string,
    lastModifiedBy: string
  },
  fmcdStatus: {
    isConnected: boolean,
    lastChecked: string,
    version?: string,
    error?: string
  }
}
```

### Architecture Pattern

The FMCD integration follows a clean component architecture:

1. **Standalone Components**: `FederationCard` for reusable UI elements
2. **Page-Level Data Management**: Federation page handles its own state and API calls
3. **Presentational Overview**: Status cards show high-level summaries
4. **Admin Controls**: Configuration isolated to admin-only interfaces

This pattern ensures:

- Clean separation of concerns between data and presentation
- Reusable components that can be used across pages
- Centralized data fetching at the page level
- Type-safe interfaces throughout
