import { Module } from '@nestjs/common';

import { AppConfigService } from '../app.config';

import { NodeApiService } from './node-api.service';

@Module({
  providers: [AppConfigService, NodeApiService],
  exports: [NodeApiService],
})
export class ChainModule {}
