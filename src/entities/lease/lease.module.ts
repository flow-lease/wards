import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Lease } from './lease.entity';
import { LeaseService } from './lease.service';

@Module({
  imports: [TypeOrmModule.forFeature([Lease])],
  providers: [LeaseService],
  exports: [LeaseService],
})
export class LeaseModule {}
