import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Payment, PaymentStatus } from './payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { AppLogger } from '../logger/logger.service';
import { Logger } from 'pino';
import { IdempotencyService } from './idempotency.service';

@Injectable()
export class PaymentsService {
  private readonly logger: Logger;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly dataSource: DataSource,
    appLogger: AppLogger,
    private readonly idempotencyService: IdempotencyService,
  ) {
    this.logger = appLogger.child({ module: PaymentsService.name });
  }

  /**
   * Create a payment with transaction support and idempotency key handling
   * Ensures atomic operation - either fully succeeds or rolls back
   * @param createPaymentDto - Payment creation data
   * @param idempotencyKey - Optional idempotency key for request deduplication
   * @returns Created payment
   */
  async create(
    createPaymentDto: CreatePaymentDto,
    idempotencyKey?: string,
  ): Promise<Payment> {
    // Check for existing idempotency key
    if (idempotencyKey) {
      const cachedResponse = await this.idempotencyService.checkIdempotencyKey(
        idempotencyKey,
        createPaymentDto as unknown as Record<string, unknown>,
      );
      if (cachedResponse) {
        return cachedResponse.responseBody as unknown as Payment;
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      this.logger.debug(
        `Starting payment creation transaction for amount: ${createPaymentDto.amount}`,
      );

      const payment = queryRunner.manager.create(Payment, {
        ...createPaymentDto,
        status: PaymentStatus.PENDING,
      });

      const savedPayment = await queryRunner.manager.save(payment);

      await queryRunner.commitTransaction();
      this.logger.info(`Payment created successfully: ${savedPayment.id}`);

      // Store idempotency key after successful creation
      if (idempotencyKey) {
        await this.idempotencyService.storeIdempotencyKey(
          idempotencyKey,
          createPaymentDto as unknown as Record<string, unknown>,
          savedPayment as unknown as Record<string, unknown>,
          201,
        );
      }

      return savedPayment;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Payment creation failed and rolled back: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(): Promise<Payment[]> {
    return await this.paymentRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOneBy({ id });
    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }
    return payment;
  }

  /**
   * Handle webhook with transaction support
   * Ensures status update is atomic
   */
  async handleWebhook(webhookDto: PaymentWebhookDto): Promise<Payment> {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      this.logger.debug(
        `Starting webhook transaction for payment: ${webhookDto.paymentId}, status: ${webhookDto.status}`,
      );

      const payment = await queryRunner.manager.findOneBy(Payment, {
        id: webhookDto.paymentId,
      });

      if (!payment) {
        throw new NotFoundException(
          `Payment with ID ${webhookDto.paymentId} not found`,
        );
      }

      payment.status = webhookDto.status;
      if (webhookDto.externalReference) {
        payment.externalReference = webhookDto.externalReference;
      }

      const updatedPayment = await queryRunner.manager.save(payment);

      await queryRunner.commitTransaction();
      this.logger.info(
        `Webhook processed successfully for payment: ${updatedPayment.id}`,
      );

      return updatedPayment;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Webhook transaction failed and rolled back: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
