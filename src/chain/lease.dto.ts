export interface LeaseDto {
  id: string;
  originTransactionId: string;
  sender: string;
  recipient: string;
  amount: number | string;
  height: number;
  // status: string;
  // cancelHeight?: number;
  // cancelTransactionId?: string;
}
