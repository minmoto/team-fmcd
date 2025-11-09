import { getStackServerApp } from "@/stack";
import { FMCDConfiguration, FMCDStatus } from "@/lib/types/fmcd";

/**
 * Saves FMCD configuration to team's serverMetadata
 */
export async function saveTeamConfig(teamId: string, config: FMCDConfiguration): Promise<void> {
  const team = await getStackServerApp().getTeam(teamId);
  if (!team) {
    throw new Error("Team not found");
  }

  const currentMetadata = team.serverMetadata || {};
  await team.update({
    serverMetadata: {
      ...currentMetadata,
      fmcdConfig: {
        baseUrl: config.baseUrl,
        password: config.password,
        isActive: config.isActive,
        createdAt: config.createdAt.toISOString(),
        updatedAt: config.updatedAt.toISOString(),
        createdBy: config.createdBy,
        lastModifiedBy: config.lastModifiedBy,
      },
    },
  });
}

/**
 * Retrieves FMCD configuration from team's serverMetadata
 */
export async function getTeamConfig(teamId: string): Promise<FMCDConfiguration | null> {
  const team = await getStackServerApp().getTeam(teamId);
  if (!team) {
    throw new Error("Team not found");
  }

  const metadata = team.serverMetadata;
  if (!metadata?.fmcdConfig) {
    return null;
  }

  const configData = metadata.fmcdConfig;
  return {
    teamId,
    baseUrl: configData.baseUrl,
    password: configData.password,
    isActive: configData.isActive,
    createdAt: new Date(configData.createdAt),
    updatedAt: new Date(configData.updatedAt),
    createdBy: configData.createdBy,
    lastModifiedBy: configData.lastModifiedBy,
  };
}

/**
 * Saves FMCD status to team's serverMetadata
 */
export async function saveTeamStatus(teamId: string, status: FMCDStatus): Promise<void> {
  const team = await getStackServerApp().getTeam(teamId);
  if (!team) {
    throw new Error("Team not found");
  }

  const currentMetadata = team.serverMetadata || {};
  await team.update({
    serverMetadata: {
      ...currentMetadata,
      fmcdStatus: {
        isConnected: status.isConnected,
        lastChecked: status.lastChecked.toISOString(),
        version: status.version,
        error: status.error,
      },
    },
  });
}

/**
 * Retrieves FMCD status from team's serverMetadata
 */
export async function getTeamStatus(teamId: string): Promise<FMCDStatus | null> {
  const team = await getStackServerApp().getTeam(teamId);
  if (!team) {
    throw new Error("Team not found");
  }

  const metadata = team.serverMetadata;
  if (!metadata?.fmcdStatus) {
    return null;
  }

  const statusData = metadata.fmcdStatus;
  return {
    isConnected: statusData.isConnected,
    lastChecked: new Date(statusData.lastChecked),
    version: statusData.version,
    error: statusData.error,
  };
}
