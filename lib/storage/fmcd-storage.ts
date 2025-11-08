import { promises as fs } from "fs";
import path from "path";
import { FMCDConfiguration, FMCDStatus } from "@/lib/types/fmcd";

const STORAGE_DIR = path.join(process.cwd(), ".fmcd-data");
const CONFIG_FILE = path.join(STORAGE_DIR, "configs.json");
const STATUS_FILE = path.join(STORAGE_DIR, "status.json");

// Ensure storage directory exists
async function ensureStorageDir() {
  try {
    await fs.access(STORAGE_DIR);
  } catch {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
  }
}

// Config storage functions
export async function getTeamConfig(teamId: string): Promise<FMCDConfiguration | null> {
  try {
    await ensureStorageDir();
    const data = await fs.readFile(CONFIG_FILE, "utf-8");
    const configs = JSON.parse(data) as Record<string, FMCDConfiguration>;
    const config = configs[teamId];

    if (config) {
      // Convert date strings back to Date objects
      config.createdAt = new Date(config.createdAt);
      config.updatedAt = new Date(config.updatedAt);
    }

    return config || null;
  } catch (error) {
    // File doesn't exist or is empty
    return null;
  }
}

export async function saveTeamConfig(teamId: string, config: FMCDConfiguration): Promise<void> {
  try {
    await ensureStorageDir();

    let configs: Record<string, FMCDConfiguration> = {};
    try {
      const data = await fs.readFile(CONFIG_FILE, "utf-8");
      configs = JSON.parse(data);
    } catch {
      // File doesn't exist, start with empty object
    }

    configs[teamId] = config;
    await fs.writeFile(CONFIG_FILE, JSON.stringify(configs, null, 2));
  } catch (error) {
    console.error("Failed to save team config:", error);
    throw error;
  }
}

// Status storage functions
export async function getTeamStatus(teamId: string): Promise<FMCDStatus | null> {
  try {
    await ensureStorageDir();
    const data = await fs.readFile(STATUS_FILE, "utf-8");
    const statuses = JSON.parse(data) as Record<string, FMCDStatus>;
    const status = statuses[teamId];

    if (status) {
      // Convert date string back to Date object
      status.lastChecked = new Date(status.lastChecked);
    }

    return status || null;
  } catch (error) {
    // File doesn't exist or is empty
    return null;
  }
}

export async function saveTeamStatus(teamId: string, status: FMCDStatus): Promise<void> {
  try {
    await ensureStorageDir();

    let statuses: Record<string, FMCDStatus> = {};
    try {
      const data = await fs.readFile(STATUS_FILE, "utf-8");
      statuses = JSON.parse(data);
    } catch {
      // File doesn't exist, start with empty object
    }

    statuses[teamId] = status;
    await fs.writeFile(STATUS_FILE, JSON.stringify(statuses, null, 2));
  } catch (error) {
    console.error("Failed to save team status:", error);
    throw error;
  }
}
