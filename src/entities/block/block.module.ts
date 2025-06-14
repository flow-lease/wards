import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Block } from './block.entity';
import { BlockService } from './block.service';

@Module({
  imports: [TypeOrmModule.forFeature([Block])],
  providers: [BlockService],
  exports: [BlockService],
})
export class BlockModule {}
