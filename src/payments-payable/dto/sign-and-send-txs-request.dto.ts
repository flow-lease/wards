import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsObject } from 'class-validator';

export class SignAndSendTxsRequest {
  @ApiProperty({
    description: 'List of MassTransferTransaction & WithId & WithProofs',
    type: 'array',
    items: { type: 'object' },
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsObject({ each: true })
  massTransferTxs: Record<string, any>[];
}
