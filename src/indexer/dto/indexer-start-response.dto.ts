import { ApiProperty } from '@nestjs/swagger';

export class IndexerStartResponse {
  @ApiProperty({ enum: ['in-progress', 'up-to-date', 'started'] })
  status: 'in-progress' | 'up-to-date' | 'started';
}
