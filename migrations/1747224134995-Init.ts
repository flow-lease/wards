import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1747224134995 implements MigrationInterface {
  name = 'Init1747224134995';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "blocks"
                             (
                               "height"       integer PRIMARY KEY NOT NULL,
                               "generator"    varchar             NOT NULL,
                               "fee"          bigint              NOT NULL,
                               "previous_fee" bigint              NOT NULL,
                               "block_reward" bigint              NOT NULL,
                               "timestamp"    datetime            NOT NULL
                             )`);
    await queryRunner.query(`CREATE TABLE "leases"
                             (
                               "id"               varchar PRIMARY KEY NOT NULL,
                               "tx_id"            varchar             NOT NULL,
                               "cancel_tx_id"     varchar,
                               "type"             integer,
                               "sender"           varchar             NOT NULL,
                               "amount"           bigint              NOT NULL,
                               "height"           integer             NOT NULL,
                               "timestamp"        datetime,
                               "cancel_height"    integer,
                               "cancel_timestamp" datetime
                             )`);
    await queryRunner.query(`CREATE TABLE "payments"
                             (
                               "tx_id"     varchar  NOT NULL,
                               "address"   varchar  NOT NULL,
                               "amount"    bigint   NOT NULL,
                               "height"    integer  NOT NULL,
                               "timestamp" datetime NOT NULL,
                               PRIMARY KEY ("tx_id", "address")
                             )`);
    await queryRunner.query(`CREATE TABLE "indexer_state"
                             (
                               "id"             varchar PRIMARY KEY NOT NULL,
                               "from_height"    integer             NOT NULL,
                               "indexed_height" integer
                             )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "indexer_state"`);
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TABLE "leases"`);
    await queryRunner.query(`DROP TABLE "blocks"`);
  }
}
