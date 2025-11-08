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
┌─ Team Configuration ──────────────────────────────────┐
│                                                       │
│  📡 FMCD Instance Configuration                       │
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
│  │ [ Test Connection ]  [ Save Configuration ]     │  │
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

### Phase 1: Configuration Management

1. Create TypeScript types for FMCD configuration
2. Build admin-only configuration page
3. Implement API routes for config CRUD operations
4. Add connection testing functionality

### Phase 2: Dashboard Integration

5. Update overview page to show FMCD status
6. Create FMCD data proxy API routes
7. Implement real-time status monitoring
8. Add error handling and user feedback

### Phase 3: Enhanced Features

9. Add transaction history views
10. Implement federation management UI
11. Add balance monitoring and alerts
12. Create audit logs for configuration changes

## Security Considerations

### Data Storage

- FMCD passwords will be encrypted at rest
- Configuration data stored securely with team association
- Access logs maintained for audit purposes

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

### Multi-Instance Support

- Support multiple FMCD instances per team
- Load balancing across instances
- Failover and redundancy configurations
- Instance-specific routing for different use cases

### Advanced Features

- Automated backup and restore procedures
- Integration with external monitoring systems
- Custom webhooks for FMCD events
- Advanced analytics and reporting capabilities
