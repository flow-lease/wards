import 'reflect-metadata';

import * as process from 'node:process';
import { DataSource } from 'typeorm';

import { Block } from './src/entities/block/block.entity';
import { Lease } from './src/entities/lease/lease.entity';
import { Payment } from './src/entities/payment/payment.entity';
import { IndexerState } from './src/indexer/entities/indexer-state.entity';

export const AppDataSource = new DataSource({
  // type: 'sqlite',
  type: 'better-sqlite3',
  database: `wards${process.env.PROFILE ? '-' + process.env.PROFILE : ''}.sqlite`,
  entities: [Block, Lease, Payment, IndexerState],
  migrations: ['./migrations/*.ts'], //TODO
  synchronize: false,
  logging: false,
});
