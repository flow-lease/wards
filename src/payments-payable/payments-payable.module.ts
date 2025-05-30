import { Module } from '@nestjs/common';

import { AppConfigService } from '../app.config';
import { BlockModule } from '../entities/block/block.module';
import { LeaseModule } from '../entities/lease/lease.module';
import { PaymentModule } from '../entities/payment/payment.module';

import { PaymentsPayableController } from './payments-payable.controller';
import { PaymentsPayableService } from './payments-payable.service';
import { PaymentsTxsService } from './payments-txs.service';

@Module({
  imports: [BlockModule, LeaseModule, PaymentModule],
  controllers: [PaymentsPayableController],
  providers: [AppConfigService, PaymentsPayableService, PaymentsTxsService],
})
export class PaymentsPayableModule {}
