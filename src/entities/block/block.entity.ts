import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'blocks' })
export class Block {
  @PrimaryColumn()
  height: number;

  @Column()
  generator: string;

  @Column({
    type: 'bigint',
    transformer: {
      to: (value: string) => BigInt(value),
      from: (value: bigint) => value.toString(),
    },
  })
  fee: string;

  @Column({
    name: 'previous_fee',
    type: 'bigint',
    transformer: {
      to: (value: string) => BigInt(value),
      from: (value: bigint) => value.toString(),
    },
  })
  previousFee: string;

  @Column({
    name: 'block_reward',
    type: 'bigint',
    transformer: {
      to: (value: string) => BigInt(value),
      from: (value: bigint) => value.toString(),
    },
  })
  blockReward: string;

  @Column({
    type: 'datetime',
    transformer: {
      to: (value: number) => new Date(value),
      from: (value: Date) => value.getTime(),
    },
  })
  timestamp: number;
}
