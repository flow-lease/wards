import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class CreateTxsRequest {
  @ApiPropertyOptional({
    description: 'Mapping of recipient addresses to transfer amounts',
    type: 'object',
    additionalProperties: {
      type: 'string',
      description: 'Amount for the given address as string',
      example: '1058360691748',
    },
    example: {
      '3MzWRPVGb721SYzT4HLbubswS2wZg9NTaRr': '1058360691748',
      '3N2wEQGk9SJyw6miZiLG66wqECUcdHXCYXH': '-286993667004',
      '3Mu4eqFSYzLVmdGr2xRiUBgxibdjDzvvqjV': '312866743',
    },
  })
  @IsOptional()
  @IsObject()
  amountByAddress?: Record<string, string>;
}
