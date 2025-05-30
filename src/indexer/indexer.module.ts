import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppConfigService } from '../app.config';
import { ChainModule } from '../chain/chain.module';
import { BlockModule } from '../entities/block/block.module';
import { LeaseModule } from '../entities/lease/lease.module';
import { PaymentModule } from '../entities/payment/payment.module';

import { IndexerState } from './entities/indexer-state.entity';
import { IndexerController } from './indexer.controller';
import { IndexerService } from './indexer.service';
import { IndexerStateService } from './indexer-state.service';
import { TxParserService } from './tx-parser.service';

@Module({
  imports: [TypeOrmModule.forFeature([IndexerState]), ChainModule, BlockModule, LeaseModule, PaymentModule],
  controllers: [IndexerController],
  providers: [AppConfigService, IndexerStateService, IndexerService, TxParserService],
})
export class IndexerModule {}
