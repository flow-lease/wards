export interface BlockHeadersDto {
  generator: string;
  timestamp: number;
  height: number;
  totalFee: string;
  rewardShares: Record<string, string | number>;
}
