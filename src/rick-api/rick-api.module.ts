import { Global, Module } from '@nestjs/common';
import { RickApiService } from './rick-api.service.js';

@Global()
@Module({
  providers: [RickApiService],
  exports: [RickApiService],
})
export class RickApiModule {}
