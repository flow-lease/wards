import { ApiProperty } from '@nestjs/swagger';

export class IndexerInfoBlocksDto {
  @ApiProperty()
  total: number;
  @ApiProperty()
  minHeight: number;
  @ApiProperty()
  maxHeight: number;
}

export class IndexerInfoDto {
  @ApiProperty()
  blocks: IndexerInfoBlocksDto;
  @ApiProperty()
  leases: number;
  @ApiProperty()
  payments: number;
}

export class PaymentsPayableSummaryResponse {
  @ApiProperty()
  indexerInfo: IndexerInfoDto;

  @ApiProperty({
    description: 'Map of address to reward details',
    type: 'object',
    additionalProperties: {
      type: 'object',
      properties: {
        amount: {
          type: 'string',
          description: 'Total reward amount for this address',
          example: '1189668523881',
        },
        percent: {
          type: 'string',
          description: 'Percentage of total rewards for this address',
          example: '89.321',
        },
      },
    },
    example: {
      '3MzWRPVGb721SYzT4HLbubswS2wZg9NTaRr': {
        amount: '1189668523881',
        percent: '89.321',
      },
      '3N2wEQGk9SJyw6miZiLG66wqECUcdHXCYXH': {
        amount: '3006332996',
        percent: '0.226',
      },
      '3Mu4eqFSYzLVmdGr2xRiUBgxibdjDzvvqjV': {
        amount: '133190752002',
        percent: '10.000',
      },
    },
  })
  rewardsDistribution: Record<string, { amount: string; percent: string }>;

  @ApiProperty({
    description: 'Map of address to outstanding debt (including negative amount)',
    type: 'object',
    additionalProperties: {
      type: 'string',
      description: 'Debt amount for this address (positive means owed, negative means overpaid)',
      example: '1058360691748',
    },
    example: {
      '3MzWRPVGb721SYzT4HLbubswS2wZg9NTaRr': '1058360691748',
      '3N2wEQGk9SJyw6miZiLG66wqECUcdHXCYXH': '-286993667004',
      '3Mu4eqFSYzLVmdGr2xRiUBgxibdjDzvvqjV': '312866743',
    },
  })
  debt: Record<string, string>;
}
