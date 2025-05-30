import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'leases' })
export class Lease {
  @PrimaryColumn()
  id: string;

  @Column({
    name: 'tx_id',
  })
  txId: string;

  @Column({
    name: 'cancel_tx_id',
    type: 'varchar',
    nullable: true,
  })
  cancelTxId?: string | null;

  @Column({
    nullable: true,
  })
  type?: number;

  @Column()
  sender: string;

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
    nullable: true,
    transformer: {
      to: (value?: number) => (value != null ? new Date(value) : null),
      from: (value: Date | null) => (value != null ? value.getTime() : undefined),
    },
  })
  timestamp?: number;

  @Column({
    name: 'cancel_height',
    type: 'integer',
    nullable: true,
  })
  cancelHeight?: number | null;

  @Column({
    name: 'cancel_timestamp',
    type: 'datetime',
    nullable: true,
    transformer: {
      to: (value?: number) => (value != null ? new Date(value) : null),
      from: (value: Date | null) => (value != null ? value.getTime() : undefined),
    },
  })
  cancelTimestamp?: number | null;
}
