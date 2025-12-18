import { existsSync, mkdirSync } from 'fs';
import path from 'path';

export const config = {
  port: parseInt(process.env.PORT || '4322', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  dataPath: process.env.DATA_PATH || './data',
  databaseUrl: process.env.DATABASE_URL,
  sessionSecret: process.env.SESSION_SECRET || 'dev-session-secret',
};

export function ensureDataDirectory(): void {
  const dataDir = path.resolve(config.dataPath);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
}

export function getDataFilePath(filename: string): string {
  return path.join(path.resolve(config.dataPath), filename);
}
