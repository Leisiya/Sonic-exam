import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  workerId: process.env.WORKER_ID ?? process.env.RAILWAY_REPLICA_ID ?? 'default',
  databaseUrl: process.env.DATABASE_URL ?? ''
};

export function ensureDatabaseUrl(): string {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  return config.databaseUrl;
}

export function warnIfWorkerIdMayConflict(): void {
  if (config.nodeEnv === 'production' && config.workerId === 'default') {
    // Keep booting, but make scaling risk explicit in logs.
    console.warn('WORKER_ID is "default" in production. Set a unique WORKER_ID per worker replica.');
  }
}
