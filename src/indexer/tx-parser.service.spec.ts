/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  CancelLeaseTransactionFromNode,
  LeaseTransactionFromNode,
  MassTransferTransactionFromNode,
  TransferTransactionFromNode,
} from '@waves/ts-types';

import { NodeApiService } from '../chain/node-api.service';

import { TxParserService } from './tx-parser.service';

describe('TxParserService', () => {
  let service: TxParserService;
  let nodeApiService: jest.Mocked<NodeApiService>;

  beforeEach(() => {
    nodeApiService = {
      isValidator: jest.fn(),
      getAddressByAlias: jest.fn(),
    } as any;

    service = new TxParserService(nodeApiService);
  });

  describe('parseLease', () => {
    it('should return lease if recipient is validator', () => {
      const tx = {
        id: 'tx1',
        type: 8,
        sender: 'sender1',
        recipient: 'validator1',
        amount: 1000,
        height: 1,
        timestamp: 12345,
      } as LeaseTransactionFromNode;

      nodeApiService.isValidator.mockReturnValue(true);
      expect(service.parseLease(tx)).toEqual({
        id: 'tx1',
        txId: 'tx1',
        type: 8,
        sender: 'sender1',
        amount: '1000',
        height: 1,
        timestamp: 12345,
      });
    });

    it('should return undefined if recipient is not validator', () => {
      nodeApiService.isValidator.mockReturnValue(false);
      expect(service.parseLease({ recipient: 'notValidator1' } as any)).toBeUndefined();
    });
  });

  describe('parseCancelLease', () => {
    it('should return cancel lease if recipient is validator', () => {
      const tx = {
        id: 'cancelTx1',
        lease: {
          id: 'lease1',
          originTransactionId: 'origTx1',
          sender: 'sender1',
          amount: 500,
          height: 2,
          recipient: 'validator1',
        },
        height: 3,
        timestamp: 54321,
      } as CancelLeaseTransactionFromNode;

      nodeApiService.isValidator.mockReturnValue(true);
      expect(service.parseCancelLease(tx)).toEqual({
        id: 'lease1',
        txId: 'origTx1',
        sender: 'sender1',
        amount: '500',
        height: 2,
        cancelTxId: 'cancelTx1',
        cancelHeight: 3,
        cancelTimestamp: 54321,
      });
    });

    it('should return undefined if lease.recipient is not validator', () => {
      nodeApiService.isValidator.mockReturnValue(false);
      expect(service.parseCancelLease({ lease: { recipient: 'notValidator1' } } as any)).toBeUndefined();
    });
  });

  describe('parseInvokeScript', () => {
    it('should return parsed leases and cancels from state changes', () => {
      const tx = {
        id: 'tx1',
        type: 16,
        timestamp: 100,
        height: 1,
        stateChanges: {
          leases: [{ id: 'l1', amount: 1000, recipient: 'validator1', sender: 'sender1' }],
          leaseCancels: [
            {
              id: 'cl1',
              originTransactionId: 'otx1',
              sender: 'sender2',
              amount: 500,
              height: 1,
              recipient: 'validator1',
            },
          ],
        },
      } as any;

      nodeApiService.isValidator.mockReturnValue(true);
      const result = service.parseInvokeScript(tx);
      expect(result.leases.length).toBe(1);
      expect(result.cancelLeases.length).toBe(1);
    });

    it('should return empty arrays if no stateChanges', () => {
      const tx = { stateChanges: null } as any;
      expect(service.parseInvokeScript(tx)).toEqual({ leases: [], cancelLeases: [] });
    });
  });

  describe('parseEthereum', () => {
    it('should parse leases and cancels from payload.stateChanges', () => {
      const tx = {
        id: 'ethTx1',
        type: 17,
        timestamp: 200,
        height: 2,
        payload: {
          stateChanges: {
            leases: [{ id: 'l2', amount: 2000, recipient: 'validator1', sender: 'sender3' }],
            leaseCancels: [],
          },
        },
      } as any;

      nodeApiService.isValidator.mockReturnValue(true);
      const result = service.parseEthereum(tx);
      expect(result.leases.length).toBe(1);
    });

    it('should return empty if payload missing or has no stateChanges', () => {
      expect(service.parseEthereum({} as any)).toEqual({ leases: [], cancelLeases: [] });
    });
  });

  describe('parseTransfer', () => {
    it('should return CreatePaymentDto when sender is validator and recipient is address', async () => {
      nodeApiService.isValidator.mockReturnValue(true);
      const tx = {
        id: 'tx1',
        sender: 'validator1',
        recipient: '3PA1KvFfq9VuJjg45p2ytGgaNjrgnLSgf4r',
        amount: 123,
        height: 1,
        timestamp: 123456,
      } as TransferTransactionFromNode;

      expect(await service.parseTransfer(tx)).toEqual({
        txId: 'tx1',
        address: '3PA1KvFfq9VuJjg45p2ytGgaNjrgnLSgf4r',
        amount: '123',
        height: 1,
        timestamp: 123456,
      });
    });

    it('should resolve alias if recipient is not address', async () => {
      nodeApiService.isValidator.mockReturnValue(true);
      nodeApiService.getAddressByAlias.mockResolvedValue('3Palias');
      const tx = {
        id: 'tx2',
        sender: 'validator2',
        recipient: 'alias',
        amount: 321,
        height: 1,
        timestamp: 123456,
      } as TransferTransactionFromNode;

      expect(await service.parseTransfer(tx)).toEqual({
        txId: 'tx2',
        address: '3Palias',
        amount: '321',
        height: 1,
        timestamp: 123456,
      });
    });

    it('should return undefined if sender is not validator', async () => {
      nodeApiService.isValidator.mockReturnValue(false);
      expect(await service.parseTransfer({} as any)).toBeUndefined();
    });
  });

  describe('parseMassTransfer', () => {
    it('should return multiple CreatePaymentDto', async () => {
      nodeApiService.isValidator.mockReturnValue(true);
      nodeApiService.getAddressByAlias.mockResolvedValue('aliasAddr');
      const tx = {
        id: 'tx3',
        sender: 'validator1',
        height: 1,
        timestamp: 123,
        transfers: [
          { recipient: 'alias1', amount: 10 },
          { recipient: '3Pxxx', amount: 20 },
        ],
      } as MassTransferTransactionFromNode;

      const result = await service.parseMassTransfer(tx);
      expect(result).toHaveLength(2);
    });

    it('should return empty array if sender is not validator', async () => {
      nodeApiService.isValidator.mockReturnValue(false);
      const result = await service.parseMassTransfer({} as any);
      expect(result).toEqual([]);
    });
  });
});
