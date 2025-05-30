import { Injectable, OnModuleInit } from '@nestjs/common';
import { address, publicKey } from '@waves/ts-lib-crypto';

import { ConfigResponse } from './dto/config.response';

@Injectable()
export class AppConfigService implements OnModuleInit {
  // Underlying source of configuration values (defaults to process.env)
  private readonly env: NodeJS.ProcessEnv = process.env;

  onModuleInit(): void {
    //validate all required env variables are present
    this.getConfigResponse();
  }

  getConfigResponse(): ConfigResponse {
    const profile = this.profile;
    const logLevel = this.logLevel;
    const chainId = this.wavesChainId;
    const nodeUrl = this.wavesNodeUrl;
    const confirmationBlocks = this.wavesConfirmationBlocks;
    const validatorAddress = this.validatorAddress;
    const nodeOwnerBeneficiaryAddress = this.nodeOwnerBeneficiaryAddress;
    const percentageToDistribute = this.percentageToDistribute;

    const privateKey = this.privateKey;
    const signerAddressFromPK = privateKey ? address({ publicKey: publicKey({ privateKey }) }, chainId) : null;

    return {
      profile,
      logLevel,
      chainId,
      nodeUrl,
      confirmationBlocks,
      validatorAddress,
      signerAddressFromPK,
      nodeOwnerBeneficiaryAddress,
      percentageToDistribute,
    };
  }

  // Specific getters for your known variables:

  /** PROFILE */
  get profile(): string | undefined {
    const value = this.env['PROFILE'];
    return value !== undefined && value !== '' ? value : undefined;
  }

  /** PORT (default: 3000) */
  get port(): number {
    return this.getNumber('PORT', 3000);
  }

  /** LOG_LEVEL (default: "info") */
  get logLevel(): string {
    return this.getString('LOG_LEVEL', 'info');
  }

  /** WAVES_NODE_URL */
  get wavesNodeUrl(): string {
    return this.getString('WAVES_NODE_URL');
  }

  /** WAVES_CHAIN_ID */
  get wavesChainId(): string {
    return this.getString('WAVES_CHAIN_ID', 'W');
  }

  /** WAVES_CONFIRMATION_BLOCKS */
  get wavesConfirmationBlocks(): number {
    return this.getNumber('WAVES_CONFIRMATION_BLOCKS', 10);
  }

  /** VALIDATOR_ADDRESS */
  get validatorAddress(): string {
    return this.getString('VALIDATOR_ADDRESS');
  }

  /** PRIVATE_KEY */
  get privateKey(): string | undefined {
    const value = this.env['PRIVATE_KEY'];
    return value !== undefined && value !== '' ? value : undefined;
  }

  /** NODE_OWNER_BENEFICIARY_ADDRESS */
  get nodeOwnerBeneficiaryAddress(): string {
    return this.getString('NODE_OWNER_BENEFICIARY_ADDRESS');
  }

  /** PERCENTAGE_TO_DISTRIBUTE */
  get percentageToDistribute(): number {
    return this.getNumber('PERCENTAGE_TO_DISTRIBUTE');
  }

  /**
   * Generic getter for string environment variables.
   * Throws if the key is missing and no defaultValue is provided.
   */
  private getString(key: string, defaultValue?: string): string {
    const value = this.env[key];
    if (value !== undefined && value !== '') {
      return value;
    }
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing environment variable: ${key}`);
  }

  /**
   * Generic getter for numeric environment variables.
   * Throws if the key is missing, not a number, and no defaultValue is provided.
   */
  private getNumber(key: string, defaultValue?: number): number {
    const raw = this.env[key];
    if (raw !== undefined && raw !== '') {
      const parsed = Number(raw);
      if (Number.isNaN(parsed)) {
        throw new Error(`Environment variable ${key} is not a valid number: "${raw}"`);
      }
      return parsed;
    }
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing environment variable: ${key}`);
  }

  /**
   * Fallback: generic accessor for any other env var you might add later.
   */
  public get<T extends string | number>(
    key: string,
    defaultValue?: T,
    parser: (raw: string) => T = (raw) => raw as unknown as T
  ): T {
    const raw = this.env[key];
    if (raw !== undefined && raw !== '') {
      return parser(raw);
    }
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing environment variable: ${key}`);
  }
}
