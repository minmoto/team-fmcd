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
}

export interface FMCDInfo {
  network: string;
  block_count: number;
  synced_to: number;
  federations: Federation[];
}

export interface Federation {
  federation_id: string;
  balance_msat: number;
  config: {
    global: {
      api_endpoints: Record<string, string>;
      consensus_version: number;
      federation_name: string;
    };
  };
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
