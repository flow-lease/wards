import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppDataSource } from '../data-source';

import { IndexerModule } from './indexer/indexer.module';
import { PaymentsPayableModule } from './payments-payable/payments-payable.module';
import { AppConfigService } from './app.config';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [process.env.PROFILE ? `.env.${process.env.PROFILE}` : '.env'],
    }),
    TypeOrmModule.forRoot({ ...AppDataSource.options, migrations: undefined }), //TODO
    IndexerModule,
    PaymentsPayableModule,
  ],
  controllers: [AppController],
  providers: [AppConfigService],
})
export class AppModule {}
