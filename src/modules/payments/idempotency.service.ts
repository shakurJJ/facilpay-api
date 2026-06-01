import {
  Injectable,
  UnprocessableEntityException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { IdempotencyKey } from './idempotency.entity';
import { createHash } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { IdempotencyKey } from './entities/idempotency-key.entity';
import { AppLogger } from '../logger/logger.service';
import { Logger } from 'pino';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class IdempotencyService {
  private readonly logger: Logger;
  private readonly ttlHours: number;

  constructor(
    @InjectRepository(IdempotencyKey)
    private readonly idempotencyRepository: Repository<IdempotencyKey>,
    private readonly configService: ConfigService,
  ) {
    this.ttlHours = this.configService.get<number>('IDEMPOTENCY_TTL_HOURS', 24);
  }

  hashRequest(body: any): string {
    return createHash('sha256').update(JSON.stringify(body)).digest('hex');
  }

  async checkKey(key: string, requestBody: any): Promise<any | null> {
    const requestHash = this.hashRequest(requestBody);
    const existing = await this.idempotencyRepository.findOne({
      where: { key },
    });

    if (!existing) {
      return null;
    }

    if (new Date() > existing.expiresAt) {
      await this.idempotencyRepository.delete({ key });
      return null;
    }

    if (existing.requestHash !== requestHash) {
      throw new UnprocessableEntityException(
        'Idempotency key reused with different request body',
      );
    }

    return existing.response;
  }

  async storeKey(key: string, requestBody: any, response: any): Promise<void> {
    const requestHash = this.hashRequest(requestBody);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.ttlHours);

    const idempotencyKey = this.idempotencyRepository.create({
      key,
      requestHash,
      response,
      expiresAt,
    });

    await this.idempotencyRepository.save(idempotencyKey);
  }

  async cleanupExpired(): Promise<void> {
    await this.idempotencyRepository.delete({
      expiresAt: LessThan(new Date()),
    });
  }
}
