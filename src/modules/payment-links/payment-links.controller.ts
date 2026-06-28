import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { PaymentLinksService } from './payment-links.service';
import { CreatePaymentLinkDto } from './dto/create-payment-link.dto';
import { PaymentLink } from './payment-link.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('payment-links')
@Controller('v1/payment-links')
@UseGuards(JwtAuthGuard)
export class PaymentLinksController {
  constructor(private readonly service: PaymentLinksService) {}

  @Post()
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Create a payment link',
    description: 'Generates a shareable payment link with a unique token.',
  })
  @ApiCreatedResponse({ description: 'Payment link created.', type: PaymentLink })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  create(@Body() dto: CreatePaymentLinkDto, @Request() req: any) {
    return this.service.create(dto, req.user.id);
  }

  @Public()
  @Get(':token')
  @ApiOperation({
    summary: 'Retrieve a payment link by token',
    description: 'Public endpoint — no authentication required. Increments view count on each call.',
  })
  @ApiParam({ name: 'token', description: '16-byte hex token from the payment link URL' })
  @ApiOkResponse({ description: 'Payment link details.' })
  @ApiNotFoundResponse({ description: 'Link not found.' })
  @ApiResponse({ status: 410, description: 'Link expired or deactivated.' })
  findByToken(@Param('token') token: string) {
    return this.service.findByToken(token);
  }

  @Delete(':id')
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Deactivate a payment link',
    description: 'Sets isActive to false. The link will return 410 Gone after deactivation.',
  })
  @ApiParam({ name: 'id', description: 'Payment link UUID' })
  @ApiNoContentResponse({ description: 'Link deactivated.' })
  @ApiNotFoundResponse({ description: 'Link not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  deactivate(@Param('id') id: string, @Request() req: any) {
    return this.service.deactivate(id, req.user.id);
  }
}
