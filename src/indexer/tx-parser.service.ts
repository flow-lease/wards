import { Injectable, Logger } from '@nestjs/common';
import { verifyAddress } from '@waves/ts-lib-crypto';
import {
  InvokeScriptTransactionFromNode,
  MassTransferTransactionFromNode,
  TransactionFromNode,
  TransferTransactionFromNode,
  TStateChanges,
} from '@waves/ts-types';
import {
  CancelLeaseTransactionFromNode,
  EthereumTransaction,
  LeaseTransactionFromNode,
} from '@waves/ts-types/transactions';

import { NodeApiService } from '../chain/node-api.service';
import { CreateLeaseDto } from '../entities/lease/dto/create-lease.dto';
import { UpsertLeaseDto } from '../entities/lease/dto/upsert-lease.dto';
import { CreatePaymentDto } from '../entities/payment/dto/create-payment.dto';

@Injectable()
export class TxParserService {
  private readonly logger = new Logger(TxParserService.name);

  constructor(private readonly nodeApiService: NodeApiService) {}

  parseLease(tx: LeaseTransactionFromNode): CreateLeaseDto | undefined {
    if (!this.nodeApiService.isValidator(tx.recipient)) {
      return undefined;
    }
    return {
      id: tx.id,
      txId: tx.id,
      type: tx.type,
      sender: tx.sender,
      amount: tx.amount.toString(),
      height: tx.height,
      timestamp: tx.timestamp,
    };
  }

  parseCancelLease(tx: CancelLeaseTransactionFromNode): UpsertLeaseDto | undefined {
    if (!this.nodeApiService.isValidator(tx.lease.recipient)) {
      return undefined;
    }
    return {
      id: tx.lease.id,
      txId: tx.lease.originTransactionId,
      // type: tx.type,
      sender: tx.lease.sender,
      amount: tx.lease.amount.toString(),
      height: tx.lease.height,
      // timestamp: tx.timestamp,
      cancelTxId: tx.id,
      cancelHeight: tx.height,
      cancelTimestamp: tx.timestamp,
    };
  }

  parseInvokeScript(tx: InvokeScriptTransactionFromNode): {
    leases: CreateLeaseDto[];
    cancelLeases: UpsertLeaseDto[];
  } {
    if (!tx.stateChanges) {
      return {
        leases: [],
        cancelLeases: [],
      };
    }

    const leases = this.extractLeasesFromStateChanges(tx.stateChanges, tx);
    const cancelLeases = this.extractCancelLeasesFromStateChanges(tx.stateChanges, tx);
    return {
      leases,
      cancelLeases,
    };
  }

  parseEthereum(tx: EthereumTransaction): {
    leases: CreateLeaseDto[];
    cancelLeases: UpsertLeaseDto[];
  } {
    if (!tx.payload || !('stateChanges' in tx.payload) || !tx.payload.stateChanges) {
      return {
        leases: [],
        cancelLeases: [],
      };
    }

    const leases = this.extractLeasesFromStateChanges(tx.payload.stateChanges, tx);
    const cancelLeases = this.extractCancelLeasesFromStateChanges(tx.payload.stateChanges, tx);
    return {
      leases,
      cancelLeases,
    };
  }

  async parseTransfer(tx: TransferTransactionFromNode): Promise<CreatePaymentDto | undefined> {
    if (this.nodeApiService.isValidator(tx.sender)) {
      const recipient = verifyAddress(tx.recipient)
        ? tx.recipient
        : await this.nodeApiService.getAddressByAlias(tx.recipient);
      return {
        txId: tx.id,
        address: recipient,
        amount: tx.amount.toString(),
        height: tx.height,
        timestamp: tx.timestamp,
      };
    }
    return undefined;
  }

  async parseMassTransfer(tx: MassTransferTransactionFromNode): Promise<CreatePaymentDto[]> {
    if (this.nodeApiService.isValidator(tx.sender)) {
      return await Promise.all(
        tx.transfers.map(async (transfer) => {
          const recipient = verifyAddress(transfer.recipient)
            ? transfer.recipient
            : await this.nodeApiService.getAddressByAlias(transfer.recipient);
          return {
            txId: tx.id,
            address: recipient,
            amount: transfer.amount.toString(),
            height: tx.height,
            timestamp: tx.timestamp,
          };
        })
      );
    }
    return Promise.resolve([]);
  }

  private extractLeasesFromStateChanges(stateChanges: TStateChanges, tx: TransactionFromNode): CreateLeaseDto[] {
    return stateChanges.leases
      .filter((lease) => this.nodeApiService.isValidator(lease.recipient))
      .map((lease) => {
        // let sender: string;
        if ('sender' in lease && typeof lease.sender === 'string' && 'id' in lease && typeof lease.id === 'string') {
          return {
            id: lease.id,
            txId: tx.id,
            type: tx.type,
            sender: lease.sender,
            amount: lease.amount.toString(),
            height: tx.height,
            timestamp: tx.timestamp,
          };
        } else {
          this.logger.error('DApp transaction unexpected lease shape', tx);
          throw new Error(`Failed to parse lease: ${JSON.stringify(lease)}`);
        }
      })
      .filter((lease) => lease !== undefined);
  }

  private extractCancelLeasesFromStateChanges(stateChanges: TStateChanges, tx: TransactionFromNode): UpsertLeaseDto[] {
    // Define a raw type with known fields
    type CancelLeaseRaw = {
      id: string;
      originTransactionId: string;
      sender: string;
      amount: number | string;
      height: number;
      recipient: string;
    };

    // Type guard to narrow any to CancelLeaseRaw
    function isCancelLeaseRaw(raw: any): raw is CancelLeaseRaw {
      return (
        typeof raw.id === 'string' &&
        typeof raw.originTransactionId === 'string' &&
        typeof raw.sender === 'string' &&
        (typeof raw.amount === 'string' || typeof raw.amount === 'number') &&
        typeof raw.height === 'number' &&
        typeof raw.recipient === 'string'
      );
    }

    return (stateChanges.leaseCancels as any[])
      .map((raw) => {
        if (!isCancelLeaseRaw(raw)) {
          this.logger.error('DApp transaction unexpected cancelLease shape', tx);
          throw new Error(`Failed to parse cancelLease: ${JSON.stringify(raw)}`);
        }
        return raw;
      })
      .filter((cl) => this.nodeApiService.isValidator(cl.recipient))
      .map((cl) => ({
        id: cl.id,
        txId: cl.originTransactionId,
        sender: cl.sender,
        amount: cl.amount.toString(),
        height: cl.height,
        cancelTxId: tx.id,
        cancelHeight: tx.height,
        cancelTimestamp: tx.timestamp,
      }));
  }
}
