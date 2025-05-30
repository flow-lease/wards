import { Injectable, Logger } from '@nestjs/common';
import {
  CANCEL_LEASE_TYPE,
  ETHEREUM,
  INVOKE_SCRIPT_TYPE,
  LEASE_TYPE,
  MASS_TRANSFER_TYPE,
  TRANSFER_TYPE,
} from '@waves/ts-types';
import * as util from 'node:util';
import { DataSource, EntityManager } from 'typeorm';

import { AppConfigService } from '../app.config';
import { BlockHeadersDto } from '../chain/block-headers.dto';
import { NodeApiService } from '../chain/node-api.service';
import { Block } from '../entities/block/block.entity';
import { BlockService } from '../entities/block/block.service';
import { CreateLeaseDto } from '../entities/lease/dto/create-lease.dto';
import { UpsertLeaseDto } from '../entities/lease/dto/upsert-lease.dto';
import { LeaseService } from '../entities/lease/lease.service';
import { CreatePaymentDto } from '../entities/payment/dto/create-payment.dto';
import { PaymentService } from '../entities/payment/payment.service';

import { IndexerStateService } from './indexer-state.service';
import { TxParserService } from './tx-parser.service';

// Abstract base class for indexer validation errors
export abstract class IndexerValidationError extends Error {
  protected constructor(message: string) {
    super(message);
    this.name = 'IndexerValidationError';
  }
}

export class FromBlockAlreadyInitializedError extends IndexerValidationError {
  constructor() {
    super('The "from" parameter is only allowed on the very first indexing. Omit it for subsequent runs.');
    this.name = 'FromBlockAlreadyInitializedError';
  }
}

export class FromBlockNotFoundError extends IndexerValidationError {
  constructor() {
    super('From block not found.');
    this.name = 'FromBlockNotFoundError';
  }
}

export class IndexerResponse {
  status: 'in-progress' | 'up-to-date' | 'started';
}

export class IndexerStatusDetails {
  status: 'in-progress' | 'ready' | 'init-require' = 'ready';
  processedFrom?: number;
  processedTo?: number;
  targetTo: number;
}

interface IndexedResult {
  savedBlocks: number;
  savedPreviousLeases: number;
  savedLeases: number;
  savedCancelLeases: number;
  savedPayments: number;
  indexedHeight: number;
}

class AccumulativeIndexedResult implements IndexedResult {
  savedBlocks: number = 0;
  savedPreviousLeases: number = 0;
  savedLeases: number = 0;
  savedCancelLeases: number = 0;
  savedPayments: number = 0;
  indexedHeight: number;

  constructor(indexedHeight: number) {
    this.indexedHeight = indexedHeight;
  }

  addIndexResult(addIndexResult: IndexedResult) {
    this.savedBlocks += addIndexResult.savedBlocks;
    this.savedPreviousLeases += addIndexResult.savedPreviousLeases;
    this.savedLeases += addIndexResult.savedLeases;
    this.savedCancelLeases += addIndexResult.savedCancelLeases;
    this.savedPayments += addIndexResult.savedPayments;
    this.indexedHeight = Math.max(this.indexedHeight, addIndexResult.indexedHeight);
  }

  getLog(): Partial<IndexedResult> {
    const entries = {
      savedBlocks: this.savedBlocks,
      savedPreviousLeases: this.savedPreviousLeases,
      savedLeases: this.savedLeases,
      savedCancelLeases: this.savedCancelLeases,
      savedPayments: this.savedPayments,
      indexedHeight: this.indexedHeight,
    };

    return (
      Object.entries(entries)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .filter(([_, value]) => value > 0)
        .reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {} as Partial<IndexedResult>)
    );
  }
}

@Injectable()
export class IndexerService {
  private readonly logger = new Logger(IndexerService.name);

  private readonly confirmationOffset: number;

  private isIndexing = false;
  private indexingTo: number;

  constructor(
    private readonly configService: AppConfigService,
    private readonly nodeApiService: NodeApiService,
    private readonly indexerStateService: IndexerStateService,
    private readonly blockService: BlockService,
    private readonly leaseService: LeaseService,
    private readonly paymentService: PaymentService,
    private readonly txParserService: TxParserService,
    private readonly datasource: DataSource
  ) {
    this.confirmationOffset = this.configService.wavesConfirmationBlocks + 1;
  }

  async init(from: number): Promise<void> {
    if ((await this.indexerStateService.getState()).fromHeight > 0) {
      throw new FromBlockAlreadyInitializedError();
    }
    await this.indexerStateService.updateFromHeight(from);
  }

  async getStatus(): Promise<IndexerStatusDetails> {
    const state = await this.indexerStateService.getState();

    const needsInitialization = !state.fromHeight || state.fromHeight === 0;
    if (needsInitialization) {
      return {
        status: 'init-require',
        processedFrom: undefined,
        processedTo: undefined,
        targetTo: await this.getToBlock(),
      };
    }

    if (this.isIndexing) {
      return {
        status: 'in-progress',
        processedFrom: state.fromHeight,
        processedTo: state.indexedHeight ?? undefined,
        targetTo: this.indexingTo,
      };
    }

    return {
      status: 'ready',
      processedFrom: state.fromHeight,
      processedTo: state.indexedHeight ?? undefined,
      targetTo: await this.getToBlock(),
    };
  }

  async startReindexing(from: number, to?: number): Promise<IndexerResponse> {
    if (this.isIndexing) {
      return { status: 'in-progress' };
    }
    this.isIndexing = true;

    if (to !== undefined && to < from) {
      throw new Error('"to" must be greater or equals "from"');
    }

    this.logger.log(
      'Reindexing... from:',
      from,
      `${to ? 'to: ' + `${util.styleText('yellow', `${to}`)}` + ' (total: ' + `${util.styleText('yellow', `${to - from + 1}`)}` + ' )' : ''}`
    );

    const { blocksRemoved, leasesRemoved, cancelLeasesRemoved, paymentsRemoved } =
      await this.datasource.manager.transaction(async (transactionalEntityManager) => {
        const state = await this.indexerStateService.getState();
        if (from <= state.fromHeight) {
          await this.indexerStateService.updateFromHeight(from, true, transactionalEntityManager);
          await this.indexerStateService.updateIndexedHeight(null, transactionalEntityManager);
        } else {
          await this.indexerStateService.updateIndexedHeight(from, transactionalEntityManager);
        }

        const blocksRemoved = await this.blockService.deleteMany({ heightGte: from }, transactionalEntityManager);
        const { leasesRemoved, cancelLeasesRemoved } = await this.leaseService.deleteMany(
          { heightGte: from },
          transactionalEntityManager
        );
        const paymentsRemoved = await this.paymentService.deleteMany({ heightGte: from }, transactionalEntityManager);

        return { blocksRemoved, leasesRemoved, cancelLeasesRemoved, paymentsRemoved };
      });

    this.logger.log(
      'Removed',
      blocksRemoved,
      'blocks,',
      leasesRemoved,
      'leases,',
      cancelLeasesRemoved,
      'cancelLeases,',
      paymentsRemoved,
      'payments'
    );

    return await this.launchIndexing(to);
  }

  async startIndexing(to?: number): Promise<IndexerResponse> {
    if (this.isIndexing) {
      return { status: 'in-progress' };
    }
    this.isIndexing = true;

    return await this.launchIndexing(to);
  }

  private async launchIndexing(to?: number): Promise<IndexerResponse> {
    try {
      const { fromBlock, toBlock, isFirstRun } = await this.prepareIndexRange(to);

      if (toBlock < fromBlock) {
        this.isIndexing = false;
        return { status: 'up-to-date' };
      }

      this.indexingTo = toBlock;
      // Fire-and-forget index process
      void this.index(fromBlock, toBlock, isFirstRun)
        .catch((err) => this.logger.error('Indexing error', err))
        .finally(() => {
          this.isIndexing = false;
        });
    } catch (err) {
      this.isIndexing = false;
      if (!(err instanceof IndexerValidationError)) {
        this.logger.warn('Indexing failed:', err.message);
      }
      throw err;
    }

    return { status: 'started' };
  }

  private async prepareIndexRange(to?: number): Promise<{ fromBlock: number; toBlock: number; isFirstRun: boolean }> {
    const { fromBlock, isFirstRun } = await this.getFromBlock();
    const toBlock = await this.getToBlock(to);
    return { fromBlock, toBlock, isFirstRun };
  }

  private async getFromBlock(): Promise<{ fromBlock: number; isFirstRun: boolean }> {
    const indexerState = await this.indexerStateService.getState();
    if (indexerState.indexedHeight) {
      return { fromBlock: indexerState.indexedHeight, isFirstRun: false };
    }
    if (indexerState.fromHeight === 0) {
      throw new FromBlockNotFoundError();
    }
    return { fromBlock: indexerState.fromHeight, isFirstRun: true };
  }

  private async getToBlock(to?: number): Promise<number> {
    const currentHeight = await this.nodeApiService.getCurrentHeight();
    return Math.min(to ?? currentHeight, currentHeight - this.confirmationOffset);
  }

  private async index(from: number, to: number, firstRun: boolean): Promise<void> {
    this.logger.log(
      'Indexing...',
      from,
      '→',
      to,
      '(total:',
      to - from + 1,
      ')',
      `${firstRun ? '(firstRun=TRUE)' : ''}`
    );

    const { leases, cancelLeases, payments } = await this.fetchTxs(from, to);
    // const { leases, cancelLases } = await this.indexTxs(3523563, to); //3479205 //3523563 //3618563 //TODO remove

    const previousLeases = firstRun ? await this.fetchPreviousStillActiveLeases(from) : [];

    const maxChunkSize = 99;
    let currentStart = from;

    const totalIndexedResult = new AccumulativeIndexedResult(from);

    try {
      while (currentStart <= to) {
        const currentEnd = Math.min(currentStart + maxChunkSize - 1, to);

        const currentFirstRun = firstRun && currentStart === from;
        const currentPreviousLeases = currentFirstRun ? previousLeases : [];
        const currentLeases = leases.filter((l) => l.height >= currentStart && l.height <= currentEnd);
        const currentCancelLeases = cancelLeases.filter(
          (cl) => cl.cancelHeight && cl.cancelHeight >= currentStart && cl.cancelHeight <= currentEnd
        );
        const currentPayments = payments.filter((p) => p.height >= currentStart && p.height <= currentEnd);
        const indexedResult = await this.indexRange(
          currentStart,
          currentEnd,
          currentPreviousLeases,
          currentLeases,
          currentCancelLeases,
          currentPayments
        );
        totalIndexedResult.addIndexResult(indexedResult);
        currentStart = currentEnd + 1;
      }
    } catch (err) {
      this.logger.warn('Indexing complete with errors', totalIndexedResult.getLog());
      throw err;
    }

    this.logger.log('Indexing complete', totalIndexedResult.getLog());
  }

  private async indexRange(
    from: number,
    to: number,
    previousLeases: UpsertLeaseDto[],
    leases: CreateLeaseDto[],
    cancelLeases: UpsertLeaseDto[],
    payments: CreatePaymentDto[]
  ): Promise<IndexedResult> {
    const blocks = await this.fetchValidatorsBlocks(from, to);

    return await this.datasource.manager.transaction(async (transactionalEntityManager) => {
      const savedBlocks = await this.saveBlocks(blocks, transactionalEntityManager);
      const { savedPreviousLeases, savedLeases, savedCancelLeases } = await this.saveLeases(
        previousLeases,
        leases,
        cancelLeases,
        transactionalEntityManager
      );
      const savedPayments = await this.savePayments(payments, transactionalEntityManager);
      const indexedHeight = await this.saveIndexedHeight(to, transactionalEntityManager);

      return { savedBlocks, savedPreviousLeases, savedLeases, savedCancelLeases, savedPayments, indexedHeight };
    });
  }

  private async fetchValidatorsBlocks(from: number, to: number): Promise<Block[]> {
    const maxChunkSize = 100;
    const allBlockHeaders: BlockHeadersDto[] = [];
    let currentStart = from - 1;

    while (currentStart <= to) {
      const currentEnd = Math.min(currentStart + maxChunkSize - 1, to);

      const chunk = await this.nodeApiService.getBlocksHeaders(currentStart, currentEnd);
      allBlockHeaders.push(...chunk);
      currentStart = currentEnd + 1;
    }

    const blocks = allBlockHeaders.map((dto, index) => {
      const blockReward = dto.rewardShares[dto.generator] ?? 0;
      const previousFee = index > 0 ? allBlockHeaders[index - 1].totalFee : 0;
      return {
        generator: dto.generator,
        height: dto.height,
        fee: dto.totalFee.toString(),
        previousFee: previousFee.toString(),
        blockReward: blockReward.toString(),
        timestamp: dto.timestamp,
      };
    });
    blocks.shift();

    const validatorBlocks = blocks.filter((b) => b.generator === this.configService.validatorAddress);
    const validatorBlocksCount = validatorBlocks.length;
    if (validatorBlocksCount > 0) {
      this.logger.debug('Fetched', blocks.length, 'blocks. Blocks generated by validator:', validatorBlocksCount);
    }
    return validatorBlocks;
  }

  private async fetchPreviousStillActiveLeases(startsBefore: number): Promise<UpsertLeaseDto[]> {
    const allActiveLeases = await this.nodeApiService.getActiveLeases(this.configService.validatorAddress);

    const leases = allActiveLeases
      .filter((lease) => lease.height < startsBefore)
      .map((l) => {
        return {
          id: l.id,
          txId: l.originTransactionId,
          sender: l.sender,
          amount: l.amount.toString(),
          height: l.height,
        };
      });

    this.logger.log('Found', leases.length, 'active leases started before', startsBefore);
    return leases;
  }

  private async fetchTxs(
    from: number,
    to: number
  ): Promise<{
    leases: CreateLeaseDto[];
    cancelLeases: UpsertLeaseDto[];
    payments: CreatePaymentDto[];
  }> {
    this.logger.log('Start Indexing Txs.. From block:', from, 'to block:', to);

    let txs = await this.nodeApiService.fetchAllTxs(from, this.configService.validatorAddress);
    txs = txs.filter((tx) => tx.height <= to).reverse();
    this.logger.log('Fetched', txs.length, 'txs');

    const allLeases: CreateLeaseDto[] = [];
    const allCancelLeases: UpsertLeaseDto[] = [];
    const allPayments: CreatePaymentDto[] = [];

    for (const tx of txs) {
      switch (tx.type) {
        case LEASE_TYPE: {
          const parseLease = this.txParserService.parseLease(tx);
          if (parseLease) {
            allLeases.push(parseLease);
          }
          break;
        }
        case CANCEL_LEASE_TYPE: {
          const parseCancelLease = this.txParserService.parseCancelLease(tx);
          if (parseCancelLease) {
            allCancelLeases.push(parseCancelLease);
          }
          break;
        }
        case INVOKE_SCRIPT_TYPE: {
          const { leases, cancelLeases } = this.txParserService.parseInvokeScript(tx);
          allLeases.push(...leases);
          allCancelLeases.push(...cancelLeases);
          break;
        }
        case ETHEREUM: {
          const { leases, cancelLeases } = this.txParserService.parseEthereum(tx);
          allLeases.push(...leases);
          allCancelLeases.push(...cancelLeases);
          break;
        }
        case TRANSFER_TYPE: {
          const payment = await this.txParserService.parseTransfer(tx);
          if (payment) {
            allPayments.push(payment);
          }
          break;
        }
        case MASS_TRANSFER_TYPE: {
          const payments = await this.txParserService.parseMassTransfer(tx);
          allPayments.push(...payments);
          break;
        }
      }
    }

    return { leases: allLeases, cancelLeases: allCancelLeases, payments: allPayments };
  }

  private async saveBlocks(blocks: Block[], manager: EntityManager): Promise<number> {
    return (await this.blockService.createMany(blocks, manager)).length;
  }

  private async saveLeases(
    previousLeases: UpsertLeaseDto[],
    leases: CreateLeaseDto[],
    cancelLeases: UpsertLeaseDto[],
    manager: EntityManager
  ): Promise<{ savedPreviousLeases: number; savedLeases: number; savedCancelLeases: number }> {
    const total = [...previousLeases, ...leases, ...cancelLeases];

    await this.leaseService.upsertMany(total, manager);
    return {
      savedPreviousLeases: previousLeases.length,
      savedLeases: leases.length,
      savedCancelLeases: cancelLeases.length,
    };
  }

  private async savePayments(payments: CreatePaymentDto[], manager: EntityManager): Promise<number> {
    return (await this.paymentService.createMany(payments, manager)).length;
  }

  private async saveIndexedHeight(indexedHeight: number, manager: EntityManager): Promise<number> {
    return await this.indexerStateService.updateIndexedHeight(indexedHeight, manager);
  }
}
