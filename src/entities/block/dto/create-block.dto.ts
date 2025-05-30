import { IsPositive, IsString, Matches } from 'class-validator';

export class CreateBlockDto {
  @IsPositive()
  height: number;

  @IsString()
  generator: string;

  @IsString()
  @Matches(/^[1-9]\d*$/, { message: 'fee must be a positive integer string' })
  fee: string;

  @IsString()
  @Matches(/^[1-9]\d*$/, { message: 'previousFee must be a positive integer string' })
  previousFee: string;

  @IsString()
  @Matches(/^[1-9]\d*$/, { message: 'blockReward must be a positive integer string' })
  blockReward: string;

  @IsPositive()
  timestamp: number;
}
