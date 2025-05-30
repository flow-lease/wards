import { ApiProperty } from '@nestjs/swagger';

export class IndexerStatusDetailsResponse {
  @ApiProperty({ enum: ['in-progress', 'ready', 'init-require'] })
  status: 'in-progress' | 'ready' | 'init-require';
  @ApiProperty({ required: false })
  processedFrom?: number;
  @ApiProperty({ required: false })
  processedTo?: number;
  @ApiProperty()
  targetTo: number;
}
