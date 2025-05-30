import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'indexer_state' })
export class IndexerState {
  @PrimaryColumn()
  id: string = 'singleton';

  @Column({ name: 'from_height' })
  fromHeight: number;

  @Column({
    name: 'indexed_height',
    type: 'integer',
    nullable: true,
  })
  indexedHeight: number | null;
}
