import { ApiProperty } from '@nestjs/swagger';
import { MassTransferTransaction } from '@waves/ts-types';
import { WithId, WithProofs } from '@waves/waves-transactions';

export class SignAndSendTxsResponse {
  @ApiProperty()
  sentTxIds: string[];
  @ApiProperty({
    nullable: true,
    description: 'Fail Message and transaction',
    type: 'object',
    additionalProperties: {},
  })
  failedTxs: { message: string; tx: MassTransferTransaction & WithId & WithProofs }[];
}
