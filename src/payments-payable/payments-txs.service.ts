import { Injectable, Logger } from '@nestjs/common';
import { publicKey } from '@waves/ts-lib-crypto';
import { MassTransferItem, MassTransferTransaction } from '@waves/ts-types';
import { broadcast, massTransfer, signTx, waitForTx, WithId, WithProofs } from '@waves/waves-transactions';

import { AppConfigService } from '../app.config';

import { PaymentsPayableService } from './payments-payable.service';

// Abstract base class for indexer validation errors
export abstract class PaymentsTxsError extends Error {
  protected constructor(message: string) {
    super(message);
    this.name = 'PaymentsTxsError';
  }
}

export class NoDataAvailableError extends PaymentsTxsError {
  constructor() {
    super('No data available. Please run the indexer first.');
    this.name = 'NoDataAvailableError';
  }
}

export class MissingPrivateKeyError extends Error {
  constructor() {
    super('Missing private key. Cannot proceed without a configured private key.');
    this.name = 'MissingPrivateKeyError';
  }
}

@Injectable()
export class PaymentsTxsService {
  private readonly logger = new Logger(PaymentsTxsService.name);

  private readonly senderPublicKey: string | undefined;

  constructor(
    private readonly config: AppConfigService,
    private readonly paymentsPayableService: PaymentsPayableService
  ) {
    const privateKey = this.config.privateKey;
    this.senderPublicKey = privateKey ? publicKey({ privateKey }) : undefined;
  }

  async createMassTransferTxs(
    paymentBySender?: Record<string, string>
  ): Promise<{ massTransferTxs: (MassTransferTransaction & WithId & WithProofs)[] }> {
    if (!this.senderPublicKey) {
      throw new MissingPrivateKeyError();
    }

    if (!paymentBySender) {
      this.logger.log('No paymentBySender provided, using summary data...');
      const summary = await this.paymentsPayableService.getSummaryData();
      if (!summary) {
        throw new NoDataAvailableError();
      }
      paymentBySender = summary.debt;
    }

    const transfers: MassTransferItem[] = [];

    for (const [recipient, amount] of Object.entries(paymentBySender)) {
      if (BigInt(amount) > 0n) {
        transfers.push({ recipient, amount });
      }
    }

    if (transfers.length === 0) {
      return {
        massTransferTxs: [],
      };
    }

    const CHUNK_SIZE = 100;
    const txs: (MassTransferTransaction & WithId & WithProofs)[] = [];
    for (let i = 0; i < transfers.length; i += CHUNK_SIZE) {
      const chunk = transfers.slice(i, i + CHUNK_SIZE);
      const tx = this.createMassTransferTx(chunk);
      txs.push(tx);
    }

    return {
      massTransferTxs: txs,
    };
  }

  private createMassTransferTx(transfers: MassTransferItem[]): MassTransferTransaction & WithId & WithProofs {
    if (!this.senderPublicKey) {
      throw new MissingPrivateKeyError();
    }

    return massTransfer({
      transfers: transfers,
      senderPublicKey: this.senderPublicKey,
      chainId: this.config.wavesChainId,
    });
  }

  async signAndSendTxs(txs: (MassTransferTransaction & WithId & WithProofs)[]): Promise<{
    sentTxIds: string[];
    failedTxs: { message: string; tx: MassTransferTransaction & WithId & WithProofs }[];
  }> {
    if (!this.senderPublicKey) {
      throw new MissingPrivateKeyError();
    }

    const sentTxIds: string[] = [];
    const failedTxs: { message: string; tx: MassTransferTransaction & WithId & WithProofs }[] = [];

    this.logger.log('Sending', txs.length, 'transactions...');

    for (let i = 0; i < txs.length; i++) {
      const tx = txs[i];
      try {
        this.logger.log(`Sending tx[${i + 1}]: ${tx.id}`);
        const signedTx = signTx(tx, { privateKey: this.config.privateKey });
        const broadcasted = await broadcast(signedTx, this.config.wavesNodeUrl);
        const txStatus = await waitForTx(broadcasted.id, { apiBase: this.config.wavesNodeUrl });
        if (txStatus.applicationStatus === 'succeeded') {
          sentTxIds.push(broadcasted.id);
        } else {
          const message = `Transaction ${broadcasted.id} did not succeed`;
          this.logger.warn(message);
          failedTxs.push({ message, tx });
        }
      } catch (error: any) {
        const message = `Failed to send transaction ${tx.id}: ${error?.message ?? error}`;
        this.logger.warn(message);
        failedTxs.push({ message, tx });
      }
    }

    this.logger.log('Sent', sentTxIds.length, '/', txs.length, 'transactions.');
    return { sentTxIds, failedTxs };
  }
}
