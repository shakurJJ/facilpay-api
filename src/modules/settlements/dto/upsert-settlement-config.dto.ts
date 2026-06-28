import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SettlementSchedule } from '../entities/merchant-settlement-config.entity';
import { IsISO4217CurrencyCode } from '../../../common/validators/is-iso4217-currency-code.validator';

export class UpsertSettlementConfigDto {
  @IsEnum(SettlementSchedule)
  @ApiProperty({ enum: SettlementSchedule, description: 'Payout frequency', example: SettlementSchedule.WEEKLY })
  schedule: SettlementSchedule;

  @IsString()
  @IsNotEmpty()
  @IsISO4217CurrencyCode({ supportedOnly: true })
  @ApiProperty({ description: 'Settlement currency', example: 'USD' })
  currency: string;
}
