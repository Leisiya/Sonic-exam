import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  workerId: process.env.WORKER_ID ?? 'default',
  databaseUrl: process.env.DATABASE_URL ?? ''
};

export function ensureDatabaseUrl(): string {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  return config.databaseUrl;
}
