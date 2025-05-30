import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TransactionFromNode } from '@waves/ts-types';
import axios from 'axios';

import { AppConfigService } from '../app.config';

import { BlockDto } from './block.dto';
import { BlockHeadersDto } from './block-headers.dto';
import { LeaseDto } from './lease.dto';

@Injectable()
export class NodeApiService implements OnModuleInit {
  private readonly logger = new Logger(NodeApiService.name);
  private readonly nodeUrl: string;

  private aliases: string[] = [];

  constructor(private readonly configService: AppConfigService) {
    this.nodeUrl = this.configService.wavesNodeUrl;
  }

  async onModuleInit(): Promise<void> {
    this.aliases = await this.getAliasesByAddress(this.configService.validatorAddress);
  }

  isValidator(addressOrAlias: string): boolean {
    return (
      addressOrAlias === this.configService.validatorAddress || this.aliases.some((alias) => alias === addressOrAlias)
    );
  }

  async getCurrentHeight(): Promise<number> {
    try {
      const url = `${this.nodeUrl}/blocks/height`;
      const axiosResponse = await axios.get<{ height: number }>(url);
      const { data } = axiosResponse;

      return data.height;
    } catch (error) {
      const message = `Failed to fetch currentHeight`;
      this.logger.error(message, error?.message, error?.response?.data);
      throw new Error(message);
    }
  }

  async getAliasesByAddress(address: string): Promise<string[]> {
    try {
      const url = `${this.nodeUrl}/alias/by-address/${address}`;
      const axiosResponse = await axios.get<Array<string>>(url);
      const { data } = axiosResponse;

      return data;
    } catch (error) {
      const message = `Failed to fetch get Aliases by address=${address}`;
      this.logger.error(message, error?.message, error?.response?.data);
      throw new Error(message);
    }
  }

  async getAddressByAlias(alias: string): Promise<string> {
    const split = alias.split(':');
    const cleanedAlias = split[split.length - 1];
    try {
      const url = `${this.nodeUrl}/alias/by-alias/${cleanedAlias}`;
      const axiosResponse = await axios.get<{ address: string }>(url);
      const { data } = axiosResponse;

      return data.address;
    } catch (error) {
      const message = `Failed to fetch get address by rawAlias=${alias}, alias=${cleanedAlias}`;
      this.logger.error(message, error?.message, error?.response?.data);
      throw new Error(message);
    }
  }

  async getActiveLeases(address: string): Promise<LeaseDto[]> {
    try {
      const url = `${this.nodeUrl}/leasing/active/${address}`;
      const axiosResponse = await axios.get<LeaseDto[]>(url);
      const { data } = axiosResponse;

      return data.filter((l) => this.isValidator(l.recipient));
    } catch (error) {
      const message = `Failed to fetch currentHeight`;
      this.logger.error(message, error?.message, error?.response?.data);
      throw new Error(message);
    }
  }

  async getBlocks(from: number, to: number): Promise<BlockDto[]> {
    try {
      this.logger.debug('Request fetchBlocks, from:', from, 'to:', to);
      const url = `${this.nodeUrl}/blocks/seq/${from}/${to}`;
      const { data } = await axios.get<BlockDto[]>(url);

      return data;
    } catch (error) {
      const message = `Failed to fetch Blocks from=${from} to=${to}`;
      this.logger.error(message, error?.message, error?.response?.data);
      throw new Error(message);
    }
  }

  async getBlocksHeaders(from: number, to: number): Promise<BlockHeadersDto[]> {
    try {
      this.logger.debug('Request fetchBlocksHeaders, from:', from, 'to:', to);
      const url = `${this.nodeUrl}/blocks/headers/seq/${from}/${to}`;
      const { data } = await axios.get<BlockHeadersDto[]>(url);

      return data;
    } catch (error) {
      const message = `Failed to fetch BlocksHeaders from=${from} to=${to}`;
      this.logger.error(message, error?.message, error?.response?.data);
      throw new Error(message);
    }
  }

  fetchAllTxs(minHeightInclusive: number, address: string): Promise<TransactionFromNode[]> {
    return this.fetchBundlingTxs(minHeightInclusive, address);
  }

  private async fetchBundlingTxs(
    minHeightInclusive: number,
    address: string,
    after?: string,
    accumulatedData: TransactionFromNode[] = []
  ): Promise<TransactionFromNode[]> {
    const result = await this.getTransactions({ address, after });
    const newAccumulatedData = accumulatedData.concat(result);

    const lastTx = result[result.length - 1];
    if (result.length === 0 || lastTx.height < minHeightInclusive) {
      return newAccumulatedData.filter((tx) => tx.height >= minHeightInclusive);
    }

    return this.fetchBundlingTxs(minHeightInclusive, address, lastTx.id, newAccumulatedData);
  }

  async getTransactions({
    address,
    limit = 1000,
    after,
  }: {
    address: string;
    limit?: number;
    after?: string;
  }): Promise<TransactionFromNode[]> {
    const query = after ? `?after=${after}` : '';
    try {
      const url = `${this.nodeUrl}/transactions/address/${address}/limit/${limit}${query}`;
      const axiosResponse = await axios.get<Array<Array<TransactionFromNode>>>(url);
      const { data } = axiosResponse;
      return data[0];
    } catch (error) {
      const message = `Failed to fetch getTransactions ${query}`;
      this.logger.error(message, error?.message, error?.response?.data);
      throw new Error(message);
    }
  }
}
