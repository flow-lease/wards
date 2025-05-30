import { TransactionFromNode } from '@waves/ts-types';

export interface BlockDto {
  timestamp: string | number;
  height: string | number;
  generator: string;
  totalFee: string | number;
  rewardShares?: {
    [key: string]: string | number;
  };
  transactions: Array<TransactionFromNode>;
}
