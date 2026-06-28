import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StellarService } from './stellar.service';
import { StellarHorizonStreamService } from './stellar-horizon-stream.service';
import { Payment } from '../payments/payment.entity';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Payment])],
  providers: [StellarService, StellarHorizonStreamService],
  exports: [StellarService, StellarHorizonStreamService],
})
export class StellarModule {}
