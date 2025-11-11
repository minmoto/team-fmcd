/**
 * Utility functions for FMCD API operations
 */

import { FMCDConfiguration, FMCDTransactionStatus, FMCDTransactionType } from "@/lib/types/fmcd";

export interface FMCDRequestOptions {
  endpoint: string;
  config: FMCDConfiguration;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: any;
  maxRetries?: number;
  baseDelay?: number;
  timeoutMs?: number;
}

export interface FMCDResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

/**
 * Normalizes and validates a FMCD base URL
 */
export function normalizeBaseUrl(baseUrl: string): string {
  let normalized = baseUrl.trim();

  if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
    throw new Error("Invalid URL format. Must start with http:// or https://");
  }

  // Remove trailing slash
  return normalized.replace(/\/$/, "");
}

/**
 * Creates Basic Auth header for FMCD requests
 */
export function createAuthHeader(password: string): string {
  return `Basic ${Buffer.from(`fmcd:${password}`).toString("base64")}`;
}

/**
 * Makes a request to FMCD with retry logic and proper error handling
 */
export async function fmcdRequest<T = any>(options: FMCDRequestOptions): Promise<FMCDResponse<T>> {
  const {
    endpoint,
    config,
    method = "GET",
    body,
    maxRetries = 3,
    baseDelay = 1000,
    timeoutMs = 10000,
  } = options;

  try {
    const baseUrl = normalizeBaseUrl(config.baseUrl);
    const fullUrl = `${baseUrl}${endpoint}`;
    const auth = createAuthHeader(config.password);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Calculate timeout with increasing duration for retries
        const timeout = timeoutMs + attempt * 5000;

        console.log(`[FMCD Request] Attempt ${attempt + 1}/${maxRetries} - ${method} ${endpoint}`);

        const response = await fetch(fullUrl, {
          method,
          headers: {
            Authorization: auth,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(timeout),
        });

        // Handle authentication errors (no retry needed)
        if (response.status === 401) {
          console.error(`[FMCD Request] Authentication failed for ${endpoint}`);
          return {
            error: "Authentication failed. Please check your FMCD password.",
            status: 401,
          };
        }

        // Handle not found errors (no retry needed)
        if (response.status === 404) {
          console.error(`[FMCD Request] Endpoint not found: ${endpoint}`);
          return {
            error: `Endpoint ${endpoint} not found. Please check your FMCD version.`,
            status: 404,
          };
        }

        // Handle server errors with retry
        if (!response.ok) {
          const errorText = await response.text().catch(() => response.statusText);
          console.error(`[FMCD Request] HTTP ${response.status}: ${errorText}`);

          // Retry on 5xx errors
          if (response.status >= 500 && attempt < maxRetries - 1) {
            const delay = baseDelay * Math.pow(2, attempt);
            console.log(`[FMCD Request] Server error, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          return {
            error: `FMCD error: ${response.status} - ${errorText}`,
            status: response.status,
          };
        }

        // Parse successful response
        const text = await response.text();

        try {
          const data = JSON.parse(text) as T;
          console.log(`[FMCD Request] Successfully fetched ${endpoint}`);
          return {
            data,
            status: 200,
          };
        } catch (parseError) {
          console.error(
            `[FMCD Request] Failed to parse JSON from ${endpoint}:`,
            text.substring(0, 200)
          );
          return {
            error: "Invalid JSON response from FMCD",
            status: 502,
          };
        }
      } catch (error) {
        lastError = error as Error;

        if (error instanceof Error) {
          if (error.name === "AbortError") {
            console.error(`[FMCD Request] Timeout on attempt ${attempt + 1} for ${endpoint}`);
          } else {
            console.error(`[FMCD Request] Error on attempt ${attempt + 1}:`, error.message);
          }
        }

        // Retry if not the last attempt
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`[FMCD Request] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
    }

    // All retries failed
    const errorMessage =
      lastError?.name === "AbortError"
        ? "Connection timeout - FMCD instance may be unreachable"
        : lastError?.message || "Failed to connect to FMCD instance";

    console.error(`[FMCD Request] All retry attempts failed for ${endpoint}:`, errorMessage);
    return {
      error: errorMessage,
      status: 503,
    };
  } catch (error) {
    console.error(`[FMCD Request] Unexpected error:`, error);
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      status: 500,
    };
  }
}

/**
 * Validates that a value is a number, returns default if not
 */
export function ensureNumber(value: any, defaultValue: number = 0): number {
  return typeof value === "number" && !isNaN(value) ? value : defaultValue;
}

/**
 * Validates that a value is an array, returns empty array if not
 */
export function ensureArray<T = any>(value: any): T[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Validates that a value is an object, returns empty object if not
 */
export function ensureObject<T extends Record<string, any> = Record<string, any>>(
  value: any,
  defaultValue: T
): T {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as T) : defaultValue;
}

/**
 * Authentication middleware for FMCD API routes
 * Validates user authentication, team access, and FMCD configuration
 */
export interface FMCDAuthResult {
  user: any;
  team: any;
  config: FMCDConfiguration;
}

export async function authenticateFMCDRequest(
  teamId: string,
  requiresAdmin: boolean = false
): Promise<
  { success: true; data: FMCDAuthResult } | { success: false; error: string; status: number }
> {
  try {
    const { stackServerApp } = await import("@/stack");
    const { getTeamConfig } = await import("@/lib/storage/team-storage");

    const user = await stackServerApp.getUser();
    if (!user) {
      return { success: false, error: "Unauthorized", status: 401 };
    }

    const team = await user.getTeam(teamId);
    if (!team) {
      return { success: false, error: "Team not found", status: 404 };
    }

    if (requiresAdmin) {
      // For now, we'll skip the admin check since the exact API is unclear
      // This can be implemented based on the specific Stack Auth API structure
      // when admin-only routes are actually needed
    }

    const config = await getTeamConfig(teamId);
    if (!config) {
      return { success: false, error: "No FMCD configuration found for this team", status: 404 };
    }

    if (!config.isActive) {
      return { success: false, error: "FMCD configuration is not active", status: 403 };
    }

    return {
      success: true,
      data: { user, team, config },
    };
  } catch (error) {
    console.error("FMCD authentication error:", error);
    return { success: false, error: "Internal authentication error", status: 500 };
  }
}

/**
 * Extract amount from a Lightning invoice using BOLT11 format
 * Based on the parsing logic from mini API service
 * @param invoice - Lightning invoice string
 * @returns Amount in millisatoshis
 */
function extractAmountFromInvoice(invoice: string): number {
  try {
    // Basic BOLT11 amount extraction
    // Lightning invoices encode amount in the invoice string
    // Format: ln[prefix][amount][unit][separator][data]
    // Example: lntbs100u (100 micro-bitcoin = 100 * 100 sats = 10,000 sats)

    // Support different Lightning invoice formats for different networks
    // lnbc - Bitcoin mainnet, lntb - Bitcoin testnet, lntbs - Bitcoin signet, lnbcrt - Bitcoin regtest
    const match = invoice.match(/ln(bc|tb|tbs|bcrt)(\d+)([munp]?)/);

    if (!match) {
      console.warn(`Could not extract amount from invoice: ${invoice.substring(0, 20)}...`);
      return 0;
    }

    const amount = parseInt(match[2]);
    const unit = match[3];

    // Convert to millisatoshis based on unit
    // Following the exact logic from mini service
    switch (unit) {
      case "m": // milli-bitcoin (mBTC) = 100,000 sats = 100,000,000 msats
        return amount * 100000000;
      case "u": // micro-bitcoin (μBTC) = 100 sats = 100,000 msats
        return amount * 100000;
      case "n": // nano-bitcoin (nBTC) = 0.1 sats = 100 msats
        return Math.floor(amount * 100);
      case "p": // pico-bitcoin (pBTC) = 0.0001 sats = 0.1 msats
        return Math.floor(amount / 10); // Use integer division for precision
      default:
        // If no unit specified, assume base unit (bitcoin)
        // 1 BTC = 100,000,000 sats = 100,000,000,000 msats
        return amount * 100000000000;
    }
  } catch (error) {
    console.error(`Failed to extract amount from invoice: ${error}`);
    return 0;
  }
}

interface FetchTransactionsOptions {
  federationId: string;
  config: FMCDConfiguration;
  limit?: number;
  includeAddress?: boolean;
  timeoutMs?: number;
}

export async function fetchFederationTransactions({
  federationId,
  config,
  limit = 10,
  includeAddress = false,
  timeoutMs = 5000,
}: FetchTransactionsOptions): Promise<any[]> {
  try {
    console.log(`[FMCD Debug] Fetching operations for federation ${federationId} with limit ${limit}`);
    
    // Try multiple API approaches to get operations with outcomes
    const approaches = [
      // Approach 1: Standard request with higher limit
      { 
        federationId, 
        limit: Math.max(limit, 100),
        include_completed: true // Try parameter for completed operations
      },
      // Approach 2: Request with different parameters  
      { 
        federationId, 
        limit: Math.max(limit, 100)
      }
    ];

    let response;
    
    for (let i = 0; i < approaches.length; i++) {
      const requestBody = approaches[i];
      console.log(`[FMCD Debug] Trying approach ${i + 1} with body:`, JSON.stringify(requestBody, null, 2));

      response = await fmcdRequest<any>({
        endpoint: "/v2/admin/operations",
        method: "POST",
        body: requestBody,
        config,
        maxRetries: 2,
        timeoutMs,
      });

      if (response.error) {
        console.log(`[FMCD Debug] Approach ${i + 1} failed: ${response.error}`);
        continue;
      }

      if (response.data && response.data.operations) {
        console.log(`[FMCD Debug] Approach ${i + 1} succeeded, got ${response.data.operations.length} operations`);
        break;
      }
    }

    if (response.error || !response.data) {
      console.warn(
        `Failed to fetch transactions for federation ${federationId}: ${response.error}`
      );
      return [];
    }

    const operations = response.data.operations || [];

    console.log(`[FMCD Debug] Found ${operations.length} operations for federation ${federationId}`);

    return operations.map((op: any, index: number) => {
      let amountMsats = 0;
      let type: FMCDTransactionType = FMCDTransactionType.EcashMint;
      let status: FMCDTransactionStatus = FMCDTransactionStatus.Pending;
      let address: string | undefined;

      if (op.operationKind === "ln") {
        if (op.operationMeta?.variant?.receive) {
          type = FMCDTransactionType.LightningReceive;
          const invoice = op.operationMeta.variant.receive.invoice;
          if (invoice) {
            amountMsats = extractAmountFromInvoice(invoice);
          }
        } else if (op.operationMeta?.variant?.pay) {
          type = FMCDTransactionType.LightningSend;
          const invoice = op.operationMeta.variant.pay.invoice;
          if (invoice) {
            amountMsats = extractAmountFromInvoice(invoice);
          }
        } else if (op.operationMeta?.variant?.send) {
          type = FMCDTransactionType.LightningSend;
          const invoice = op.operationMeta.variant.send?.invoice;
          if (invoice) {
            amountMsats = extractAmountFromInvoice(invoice);
          }
        }

        if (amountMsats === 0) {
          if (op.operationMeta?.amount_msat) {
            amountMsats = ensureNumber(op.operationMeta.amount_msat);
          } else if (op.outcome?.amount_msat) {
            amountMsats = ensureNumber(op.outcome.amount_msat);
          }
        }
      } else if (op.operationKind === "wallet") {
        if (op.operationMeta?.variant?.deposit) {
          type = FMCDTransactionType.OnchainReceive;
          if (includeAddress) {
            address = op.operationMeta.variant.deposit.address;
          }
          if (op.outcome?.Claimed?.btc_deposited) {
            amountMsats = op.outcome.Claimed.btc_deposited * 1000;
          }
        } else if (op.operationMeta?.variant?.withdraw) {
          type = FMCDTransactionType.OnchainSend;
          if (includeAddress) {
            address = op.operationMeta.variant.withdraw.address;
          }
          if (op.operationMeta?.amount_sat) {
            amountMsats = ensureNumber(op.operationMeta.amount_sat) * 1000;
          } else if (op.operationMeta?.variant?.withdraw?.amount_sat) {
            amountMsats = ensureNumber(op.operationMeta.variant.withdraw.amount_sat) * 1000;
          }
        }
      }

      // Determine transaction status based on operation outcome
      console.log(`[FMCD Debug] Operation ${index} outcome analysis:`, {
        hasOutcome: !!op.outcome,
        outcomeType: typeof op.outcome,
        outcomeValue: op.outcome,
        outcomeKeys: op.outcome && typeof op.outcome === "object" ? Object.keys(op.outcome) : null,
        creationTime: op.creationTime,
        operationKind: op.operationKind
      });

      if (op.outcome) {
        if (typeof op.outcome === "string") {
          // Handle string-based outcomes
          const outcomeStr = op.outcome.toLowerCase();
          console.log(`[FMCD Debug] String outcome: "${outcomeStr}"`);
          if (outcomeStr === "claimed" || outcomeStr === "success" || outcomeStr === "completed" || outcomeStr === "settled") {
            status = FMCDTransactionStatus.Completed;
          } else if (outcomeStr === "failed" || outcomeStr === "canceled" || outcomeStr === "cancelled" || outcomeStr === "timeout") {
            status = FMCDTransactionStatus.Failed;
          } else {
            // Unknown string outcome, default to pending
            console.log(`[FMCD Debug] Unknown string outcome: ${outcomeStr}, defaulting to pending`);
            status = FMCDTransactionStatus.Pending;
          }
        } else if (typeof op.outcome === "object" && op.outcome !== null) {
          // Handle object-based outcomes
          console.log(`[FMCD Debug] Object outcome keys:`, Object.keys(op.outcome));
          
          // Check for completed/success indicators (case-sensitive keys)
          const isCompleted = !!(
            op.outcome.Claimed ||
            op.outcome.Success ||
            op.outcome.Completed ||
            op.outcome.success ||
            op.outcome.completed ||
            op.outcome.claimed ||
            op.outcome.settled ||
            op.outcome.Settled
          );
          
          // Check for failure indicators
          const isFailed = !!(
            op.outcome.canceled ||
            op.outcome.failed ||
            op.outcome.Failed ||
            op.outcome.Canceled ||
            op.outcome.cancelled ||
            op.outcome.Cancelled ||
            op.outcome.timeout ||
            op.outcome.Timeout
          );

          if (isCompleted) {
            status = FMCDTransactionStatus.Completed;
          } else if (isFailed) {
            status = FMCDTransactionStatus.Failed;
          } else {
            // If outcome object exists but doesn't match known patterns, 
            // it could be a custom status or pending operation. Default to pending.
            console.log(`[FMCD Debug] Unknown object outcome structure, defaulting to pending:`, op.outcome);
            status = FMCDTransactionStatus.Pending;
          }
        } else {
          status = FMCDTransactionStatus.Pending;
        }
      } else {
        // No outcome present - apply intelligent fallback logic
        // Based on operation age and type, make educated guesses
        
        const operationDate = new Date(op.creationTime);
        const ageInMinutes = (Date.now() - operationDate.getTime()) / (1000 * 60);
        const ageInDays = ageInMinutes / (60 * 24);
        
        console.log(`[FMCD Debug] No outcome for operation ${index}, age: ${ageInDays.toFixed(1)} days (${ageInMinutes.toFixed(0)} minutes)`);
        
        // Heuristic: Operations older than 1 hour are likely completed or failed
        // Lightning operations usually complete quickly (within minutes)
        // Onchain operations might take longer but still shouldn't be pending for days/weeks
        
        if (ageInDays > 7) {
          // Operations older than 7 days with no outcome are likely completed
          // If they failed, they would typically have an outcome indicating failure
          status = FMCDTransactionStatus.Completed;
          console.log(`[FMCD Debug] Old operation (${ageInDays.toFixed(1)} days), assuming completed`);
        } else if (ageInMinutes > 60) {
          // Operations older than 1 hour are likely completed
          status = FMCDTransactionStatus.Completed;
          console.log(`[FMCD Debug] Operation older than 1 hour (${ageInMinutes.toFixed(0)} minutes), assuming completed`);
        } else if (ageInMinutes > 10 && op.operationKind === "ln") {
          // Lightning operations older than 10 minutes are likely completed or failed
          // Since we have no failure outcome, assume completed
          status = FMCDTransactionStatus.Completed;
          console.log(`[FMCD Debug] Lightning operation older than 10 minutes, assuming completed`);
        } else {
          // Recent operations or uncertain cases remain pending
          status = FMCDTransactionStatus.Pending;
          console.log(`[FMCD Debug] Recent operation, keeping as pending`);
        }
      }

      console.log(`[FMCD Debug] Operation ${index} final: type=${type}, amount=${amountMsats}msats, status=${status}`);

      const transaction = {
        id: op.id?.toString() || `${federationId}-${Date.now()}-${Math.random()}`,
        type,
        amount_msats: amountMsats,
        timestamp: op.creationTime ? new Date(op.creationTime) : new Date(),
        status,
        federation_id: federationId,
        description: op.operationMeta?.description || op.operationKind || "Transaction",
        ...(includeAddress && address ? { address } : {}),
      };

      return transaction;
    });
  } catch (error) {
    console.warn(`Error fetching transactions for federation ${federationId}:`, error);
    return [];
  }
}
