import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { Payment } from './payment.entity';
import { WebhookSignatureService } from './webhook-signature.service';
import { WebhookGuard } from './webhook.guard';
import { IdempotencyKey } from './idempotency.entity';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyInterceptor } from './idempotency.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, IdempotencyKey])],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    WebhookSignatureService,
    WebhookGuard,
    IdempotencyService,
    IdempotencyInterceptor,
  ],
  exports: [PaymentsService, WebhookSignatureService, WebhookGuard],
})
export class PaymentsModule {}
