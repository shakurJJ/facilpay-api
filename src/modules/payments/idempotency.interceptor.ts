import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { IdempotencyService } from './idempotency.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotencyService: IdempotencyService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const idempotencyKey = request.headers['idempotency-key'];

    if (!idempotencyKey) {
      return next.handle();
    }

    const cachedResponse = await this.idempotencyService.checkKey(
      idempotencyKey,
      request.body,
    );

    if (cachedResponse) {
      return of(cachedResponse);
    }

    return next.handle().pipe(
      tap(async (response) => {
        await this.idempotencyService.storeKey(
          idempotencyKey,
          request.body,
          response,
        );
      }),
    );
  }
}
