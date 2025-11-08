/**
 * Utility functions for FMCD API operations
 */

import { FMCDConfiguration } from "@/lib/types/fmcd";

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
  const { endpoint, config, method = "GET", body, maxRetries = 3, baseDelay = 1000, timeoutMs = 10000 } = options;

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
