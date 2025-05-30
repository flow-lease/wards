import { IsPositive, IsString, Matches } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  txId: string;

  @IsString()
  address: string;

  @IsString()
  @Matches(/^[1-9]\d*$/, { message: 'amount must be a positive integer string' })
  amount: string;

  @IsPositive()
  height: number;

  @IsPositive()
  timestamp: number;
}
