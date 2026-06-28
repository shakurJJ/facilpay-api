import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { randomBytes, createHmac } from 'crypto';
import { AppLogger } from '../logger/logger.service';
import { Logger } from 'pino';
import { WebhookEndpoint } from './entities/webhook-endpoint.entity';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto';
import { UpdateWebhookEndpointDto } from './dto/update-webhook-endpoint.dto';

@Injectable()
export class WebhooksService {
  private readonly logger: Logger;

  constructor(
    @InjectRepository(WebhookEndpoint)
    private readonly repo: Repository<WebhookEndpoint>,
    private readonly httpService: HttpService,
    appLogger: AppLogger,
  ) {
    this.logger = appLogger.child({ module: WebhooksService.name });
  }

  async create(dto: CreateWebhookEndpointDto, merchantId: string): Promise<WebhookEndpoint> {
    const secret = `whsec_${randomBytes(32).toString('hex')}`;
    const endpoint = this.repo.create({ ...dto, merchantId, secret });
    const saved = await this.repo.save(endpoint);
    this.logger.info({ endpointId: saved.id, merchantId }, 'Webhook endpoint registered');
    return saved;
  }

  async findAll(merchantId: string): Promise<WebhookEndpoint[]> {
    return this.repo.find({
      where: { merchantId },
      order: { createdAt: 'DESC' },
    });
  }

  async update(
    id: string,
    dto: UpdateWebhookEndpointDto,
    merchantId: string,
  ): Promise<WebhookEndpoint> {
    const endpoint = await this.findOwned(id, merchantId);
    Object.assign(endpoint, dto);
    const updated = await this.repo.save(endpoint);
    this.logger.info({ endpointId: id, merchantId }, 'Webhook endpoint updated');
    return updated;
  }

  async remove(id: string, merchantId: string): Promise<void> {
    const endpoint = await this.findOwned(id, merchantId);
    await this.repo.remove(endpoint);
    this.logger.info({ endpointId: id, merchantId }, 'Webhook endpoint deleted');
  }

  async sendTest(id: string, merchantId: string): Promise<{ delivered: boolean; statusCode: number | null; error: string | null }> {
    const endpoint = await this.findOwned(id, merchantId);

    const payload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test event from FacilPay',
        endpointId: endpoint.id,
      },
    };

    const body = JSON.stringify(payload);
    const signature = createHmac('sha256', endpoint.secret)
      .update(body)
      .digest('hex');

    try {
      const response = await firstValueFrom(
        this.httpService.post(endpoint.url, payload, {
          timeout: 10_000,
          headers: {
            'Content-Type': 'application/json',
            'X-FacilPay-Signature': signature,
            'X-FacilPay-Event': 'test',
          },
        }),
      );

      this.logger.info(
        { endpointId: id, statusCode: response.status },
        'Test webhook delivered successfully',
      );
      return { delivered: true, statusCode: response.status, error: null };
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number }; message?: string };
      const statusCode = axiosError?.response?.status ?? null;
      const errorMsg = error instanceof Error ? error.message : String(error);

      this.logger.warn(
        { endpointId: id, statusCode, error: errorMsg },
        'Test webhook delivery failed',
      );
      return { delivered: false, statusCode, error: errorMsg };
    }
  }

  private async findOwned(id: string, merchantId: string): Promise<WebhookEndpoint> {
    const endpoint = await this.repo.findOneBy({ id });
    if (!endpoint) throw new NotFoundException(`Webhook endpoint ${id} not found`);
    if (endpoint.merchantId !== merchantId) throw new ForbiddenException();
    return endpoint;
  }
}
