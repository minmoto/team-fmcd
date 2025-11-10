# FMCD Integration Design Document

## Overview

This document outlines the design for integrating FMCD (Fedimint Client Daemon) instances with team management in the dashboard application. Each team will have a single FMCD instance configured with team-specific settings that only team administrators can modify.

## Architecture

### Team-FMCD Instance Mapping

Each team in the Stack Auth system will have one associated FMCD instance configuration:

```
Team (Stack Auth) ←→ FMCD Instance Configuration
```

### Data Model

```typescript
interface FMCDConfiguration {
  teamId: string; // Stack Auth team ID
  baseUrl: string; // FMCD instance base URL (e.g., "http://localhost:3333")
  password: string; // FMCD authentication password
  isActive: boolean; // Whether this configuration is active
  createdAt: Date; // When configuration was created
  updatedAt: Date; // Last modification time
  createdBy: string; // User ID who created the configuration
  lastModifiedBy: string; // User ID who last modified the configuration
}

interface FMCDStatus {
  isConnected: boolean; // Whether dashboard can connect to FMCD
  lastChecked: Date; // Last health check timestamp
  version?: string; // FMCD version if connected
  error?: string; // Connection error message if any
}
```

## User Interface Design

### Navigation Structure

The existing dashboard layout includes a "Configuration" page in the sidebar. This will be enhanced to show FMCD settings.

### Configuration Page Layout

```
┌─ Configuration ───────────────────────────────────────┐
│                                                       │
│  📡 FMCD Connection                                   │
│  ┌─────────────────────────────────────────────────┐  │
│  │ Status: ● Connected / ● Disconnected / ● Error  │  │
│  │ Last checked: 2 minutes ago                     │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  [Admin Only Section]                                 │
│  ┌─────────────────────────────────────────────────┐  │
│  │ FMCD Base URL: [http://localhost:3333       ]   │  │
│  │ Password:      [••••••••••••••••••••••••••••]   │  │
│  │                                                 │  │
│  │ [ Test Connection ]  [ Save Connection ]        │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  [Non-Admin View]                                     │
│  ┌─────────────────────────────────────────────────┐  │
│  │ ℹ️  FMCD instance is configured by team admin   │  │
│  │    Contact your team administrator to modify    │  │
│  │    connection settings.                         │  │
│  └─────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────┘
```

### Dashboard Overview Enhancement

The main dashboard will show FMCD-related metrics and status:

```
┌─ FMCD Instance Status ────┐  ┌─ Federation Info ─────────┐
│ Status: ● Connected       │  │ Federation: Alpha         │
│ Balance: 1,234 sats       │  │ Members: 4/4 online       │
│ Last sync: 30s ago        │  │ Block height: 2,845,123   │
└───────────────────────────┘  └───────────────────────────┘

┌─ Recent Transactions ────────────────────────────────────┐
│ • Lightning receive: +500 sats  (2m ago)                 │
│ • Ecash mint: +1000 sats        (15m ago)                │
│ • Lightning send: -200 sats     (1h ago)                 │
└──────────────────────────────────────────────────────────┘
```

## Access Control

### Permission System

- **Team Admins**: Full access to FMCD configuration settings
  - Can modify base URL and password
  - Can test connections
  - Can save/update configurations
- **Team Members**: Read-only access
  - Can see connection status
  - Can view FMCD data (balances, transactions)
  - Cannot modify configuration settings

### Authentication Flow

1. User logs into dashboard via Stack Auth
2. Selects team from team switcher
3. Dashboard loads FMCD configuration for selected team
4. If user has admin permission on team:
   - Show configuration form
   - Allow modifications
5. If user is regular member:
   - Show read-only status
   - Display informational message

## API Design

### Configuration Management

```typescript
// GET /api/team/[teamId]/fmcd/config
// Returns FMCD configuration for team (admin only)
interface GetConfigResponse {
  config: FMCDConfiguration | null;
  status: FMCDStatus;
}

// POST /api/team/[teamId]/fmcd/config
// Creates or updates FMCD configuration (admin only)
interface UpdateConfigRequest {
  baseUrl: string;
  password: string;
  isActive: boolean;
}

// POST /api/team/[teamId]/fmcd/test
// Tests connection to FMCD instance (admin only)
interface TestConnectionResponse {
  isConnected: boolean;
  version?: string;
  error?: string;
}
```

### FMCD Data Proxy

```typescript
// GET /api/team/[teamId]/fmcd/info
// Proxies request to FMCD /v2/admin/info
interface FMCDInfo {
  network: string;
  block_count: number;
  synced_to: number;
  federations: Federation[];
}

// GET /api/team/[teamId]/fmcd/balance
// Proxies request to FMCD balance endpoint
interface FMCDBalance {
  total_msats: number;
  ecash_msats: number;
  lightning_msats: number;
  onchain_sats: number;
}
```

## Implementation Plan

### Phase 1: Configuration Management ✅ COMPLETED

1. ✅ Create TypeScript types for FMCD configuration (`lib/types/fmcd.ts`)
2. ✅ Build admin-only configuration page (`components/fmcd-config.tsx`)
3. ✅ Implement API routes for config CRUD operations (`app/api/team/[teamId]/fmcd/`)
4. ✅ Add connection testing functionality
5. ✅ Implement Stack Auth `serverMetadata` storage (`lib/storage/team-storage.ts`)

### Phase 2: Dashboard Integration ✅ COMPLETED

6. ✅ Update overview page to show FMCD status (`components/fmcd-status-cards.tsx`)
7. ✅ Create FMCD data proxy API routes (balance, info endpoints)
8. ✅ Implement real-time status monitoring
9. ✅ Add error handling and user feedback

### Phase 3: Enhanced Features

9. Add transaction history views
10. Implement federation management UI
11. Add balance monitoring and alerts
12. Create audit logs for configuration changes

## Data Persistence

### Stack Auth Team Metadata Storage

FMCD configurations are stored in Stack Auth's `team.serverMetadata` field, which provides:

- **Native Security**: Stack Auth handles encryption and secure storage automatically
- **Team Isolation**: Each team's configuration is completely isolated from other teams
- **Server-Only Access**: `serverMetadata` is only accessible from server-side code, never exposed to clients
- **Built-in Reliability**: Leverages Stack Auth's proven infrastructure for data persistence

#### Storage Structure

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

### Benefits of Stack Auth Storage

- **No Custom Encryption**: Stack Auth's `serverMetadata` is designed for secure credential storage
- **Automatic Backups**: Built into Stack Auth's infrastructure
- **Team Permissions**: Naturally integrates with Stack Auth's team permission system
- **Scalability**: Handles growth without additional infrastructure
- **Compliance**: Benefits from Stack Auth's security certifications and compliance

## Security Considerations

### Data Storage

- FMCD passwords stored in Stack Auth's secure `serverMetadata`
- No additional encryption layer needed - Stack Auth handles security
- Configuration data automatically associated with teams
- Access logs maintained through Stack Auth's audit system

### API Security

- All FMCD configuration endpoints require team admin permission
- FMCD instance credentials never exposed to frontend
- Server-side validation of all configuration changes
- Rate limiting on connection tests to prevent abuse

### Network Security

- FMCD connections made from server-side only
- Support for SSL/TLS connections to remote FMCD instances
- Configurable timeout and retry policies
- Network isolation options for production deployments

## Error Handling

### Connection Failures

- Graceful degradation when FMCD instance is unavailable
- Clear error messages for different failure scenarios
- Retry logic with exponential backoff
- Fallback to cached data where appropriate

### Configuration Errors

- Validation of FMCD URLs and connection parameters
- Preview/test mode before saving configurations
- Rollback capability for failed updates
- User-friendly error messages with suggested fixes

## Monitoring and Observability

### Health Checks

- Periodic connectivity tests to configured FMCD instances
- Status dashboard showing instance health across teams
- Alerting for prolonged disconnections
- Performance metrics collection

### Audit Trail

- Log all configuration changes with timestamps and user IDs
- Track connection attempts and results
- Monitor API usage patterns
- Generate reports for team administrators

## Future Enhancements

### Advanced Features

- Automated backup and restore procedures
- Integration with external monitoring systems
- Custom webhooks for FMCD events
- Advanced analytics and reporting capabilities
