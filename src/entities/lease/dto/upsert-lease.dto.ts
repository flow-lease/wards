import { IsOptional, IsPositive, IsString, Matches } from 'class-validator';

export class UpsertLeaseDto {
  @IsString()
  id: string;
  @IsString()
  txId: string;
  @IsOptional()
  @IsString()
  cancelTxId?: string;
  @IsOptional()
  @IsPositive()
  type?: number;
  @IsString()
  sender: string;
  @IsString()
  @Matches(/^[1-9]\d*$/, { message: 'amount must be a positive integer string' })
  amount: string;
  @IsPositive()
  height: number;
  @IsOptional()
  @IsPositive()
  timestamp?: number;
  @IsOptional()
  @IsPositive()
  cancelHeight?: number;
  @IsOptional()
  cancelTimestamp?: number;
}
