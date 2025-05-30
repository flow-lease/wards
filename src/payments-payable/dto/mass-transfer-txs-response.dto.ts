import { ApiProperty } from '@nestjs/swagger';
import { MassTransferTransaction } from '@waves/ts-types';
import { WithId, WithProofs } from '@waves/waves-transactions';

export class MassTransferTxsResponse {
  @ApiProperty({
    nullable: true,
    description: 'MassTransferTransaction & WithId & WithProofs',
    type: 'object',
    additionalProperties: {},
  })
  massTransferTxs: (MassTransferTransaction & WithId & WithProofs)[];
}
