export interface FMCDConfiguration {
  teamId: string;
  baseUrl: string;
  password: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastModifiedBy: string;
}

export interface FMCDStatus {
  isConnected: boolean;
  lastChecked: Date;
  version?: string;
  error?: string;
}

export interface GetConfigResponse {
  config: FMCDConfiguration | null;
  status: FMCDStatus;
}

export interface UpdateConfigRequest {
  baseUrl: string;
  password: string;
  isActive: boolean;
}

export interface TestConnectionResponse {
  isConnected: boolean;
  version?: string;
  error?: string;
  details?: string; // Additional error details
  federationCount?: number; // Number of federations if connected
}

export interface FMCDInfo {
  network: string; // Extracted from first federation's network
  federations: Federation[];
  // Note: FMCD /v2/admin/info API doesn't provide these fields:
  // - block_count, synced_to, version, uptime, node_id
}

export interface Federation {
  federation_id: string;
  balance_msat: number; // Maps to totalAmountMsat from API
  config: {
    global: {
      federation_name?: string; // From meta.federation_name
      meta?: Record<string, any>; // Contains federation_name and meta_external_url
      network?: string; // Network the federation operates on
    };
  };
  // Fields computed/assumed since not in API response
  status?: "active" | "inactive" | "syncing";
}

export interface FMCDBalance {
  total_msats: number;
  ecash_msats: number;
  lightning_msats: number;
  onchain_sats: number;
}

export interface FMCDTransaction {
  id: string;
  type:
    | "lightning_receive"
    | "lightning_send"
    | "ecash_mint"
    | "ecash_spend"
    | "onchain_receive"
    | "onchain_send";
  amount_msats: number;
  timestamp: Date;
  status: "pending" | "completed" | "failed";
  federation_id?: string;
  description?: string;
}
