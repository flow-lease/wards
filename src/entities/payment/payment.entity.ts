import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'payments' })
export class Payment {
  @PrimaryColumn({
    name: 'tx_id',
  })
  txId: string;

  @PrimaryColumn()
  address: string;

  @Column({
    type: 'bigint',
    transformer: {
      to: (value: string) => BigInt(value),
      from: (value: bigint) => value.toString(),
    },
  })
  amount: string;

  @Column()
  height: number;

  @Column({
    type: 'datetime',
    transformer: {
      to: (value: number) => new Date(value),
      from: (value: Date) => value.getTime(),
    },
  })
  timestamp: number;
}
