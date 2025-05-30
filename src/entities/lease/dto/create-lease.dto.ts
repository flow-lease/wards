import { IsOptional, IsPositive, IsString, Matches } from 'class-validator';

export class CreateLeaseDto {
  @IsString()
  id: string;
  @IsString()
  txId: string;
  @IsOptional()
  @IsString()
  cancelTxId?: string;
  @IsPositive()
  type: number;
  @IsString()
  sender: string;
  @IsString()
  @Matches(/^[1-9]\d*$/, { message: 'amount must be a positive integer string' })
  amount: string;
  @IsPositive()
  height: number;
  @IsPositive()
  timestamp: number;
  @IsOptional()
  @IsPositive()
  cancelHeight?: number;
  @IsOptional()
  cancelTimestamp?: number;
}
