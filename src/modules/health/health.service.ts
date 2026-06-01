import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppLogger } from '../logger/logger.service';
import { Logger } from 'pino';
import { StellarService } from '../stellar/stellar.service';
import * as os from 'os';

interface HealthCheckResult {
  status: 'ok' | 'degraded' | 'unhealthy';
  statusCode: number;
  timestamp: string;
  uptime: number;
  services: {
    database: {
      status: 'healthy' | 'unhealthy';
      message: string;
    };
    stellar: {
      status: 'healthy' | 'unhealthy';
      message: string;
    };
    system: {
      memory: {
        used: number;
        total: number;
        percentUsed: number;
      };
      uptime: number;
    };
  };
}

@Injectable()
export class HealthService {
  private readonly logger: Logger;

  constructor(
    private readonly dataSource: DataSource,
    private readonly stellarService: StellarService,
    appLogger: AppLogger,
  ) {
    this.logger = appLogger.child({ module: HealthService.name });
  }

  async check(): Promise<HealthCheckResult> {
    const dbStatus = await this.checkDatabase();
    const stellarStatus = await this.checkStellar();
    const systemStatus = this.checkSystem();

    const isHealthy = dbStatus.status === 'healthy' && stellarStatus.status === 'healthy';
    const isDegraded = !isHealthy && (dbStatus.status === 'healthy' || stellarStatus.status === 'healthy');

    const overallStatus = isHealthy ? 'ok' : isDegraded ? 'degraded' : 'unhealthy';
    const statusCode = isHealthy ? 200 : isDegraded ? 200 : 503;

    return {
      status: overallStatus,
      statusCode,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: dbStatus,
        stellar: stellarStatus,
        system: systemStatus,
      },
    };
  }

  private async checkDatabase(): Promise<{
    status: 'healthy' | 'unhealthy';
    message: string;
  }> {
    try {
      if (this.dataSource.isInitialized) {
        await this.dataSource.query('SELECT 1');
        return { status: 'healthy', message: 'Database connection is healthy' };
      }
      this.logger.warn('Database not initialized');
      return { status: 'unhealthy', message: 'Database not initialized' };
    } catch (error) {
      this.logger.error(
        {
          err:
            error instanceof Error ? error : new Error('Database check failed'),
        },
        'Database health check failed',
      );
      return {
        status: 'unhealthy',
        message:
          error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }

  private async checkStellar(): Promise<{
    status: 'healthy' | 'unhealthy';
    message: string;
  }> {
    try {
      // Ping Stellar horizon endpoint
      const horizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${horizonUrl}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        return { status: 'healthy', message: 'Stellar network is reachable' };
      }
      return { status: 'unhealthy', message: `Stellar health check returned ${response.status}` };
    } catch (error) {
      this.logger.warn(
        { err: error instanceof Error ? error : new Error('Stellar check failed') },
        'Stellar health check failed',
      );
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Stellar network unreachable',
      };
    }
  }

  private checkSystem(): {
    memory: { used: number; total: number; percentUsed: number };
    uptime: number;
  } {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const percentUsed = (usedMemory / totalMemory) * 100;

    return {
      memory: {
        used: usedMemory,
        total: totalMemory,
        percentUsed: Math.round(percentUsed * 100) / 100,
      },
      uptime: process.uptime(),
    };
  }
}
