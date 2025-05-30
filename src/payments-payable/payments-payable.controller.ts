import { Body, Controller, Get, Post, PreconditionFailedException } from '@nestjs/common';
import { ApiBody, ApiOkResponse } from '@nestjs/swagger';
import { MassTransferTransaction } from '@waves/ts-types';
import { WithId, WithProofs } from '@waves/waves-transactions';

import { CreateTxsRequest } from './dto/create-txs-request.dto';
import { MassTransferTxsResponse } from './dto/mass-transfer-txs-response.dto';
import { PaymentsPayableSummaryResponse } from './dto/payments-payable-summary-response.dto';
import { SignAndSendTxsRequest } from './dto/sign-and-send-txs-request.dto';
import { SignAndSendTxsResponse } from './dto/sign-and-send-txs-response.dto';
import { PaymentsPayableService } from './payments-payable.service';
import { MissingPrivateKeyError, NoDataAvailableError, PaymentsTxsService } from './payments-txs.service';

@Controller('payments-payable')
export class PaymentsPayableController {
  constructor(
    private readonly paymentsPayableService: PaymentsPayableService,
    private readonly paymentsTxsService: PaymentsTxsService
  ) {}

  @Get('summary')
  @ApiOkResponse({ type: PaymentsPayableSummaryResponse })
  async getSummary(): Promise<PaymentsPayableSummaryResponse> {
    const result = await this.paymentsPayableService.getSummaryData();
    if (!result) {
      throw new PreconditionFailedException('No data available. Please run the indexer first.');
    }
    return result;
  }

  @Post('create-txs')
  @ApiBody({
    type: CreateTxsRequest,
    required: false,
  })
  @ApiOkResponse({ type: MassTransferTxsResponse })
  async createTx(@Body() createTxs: CreateTxsRequest = {}): Promise<MassTransferTxsResponse> {
    try {
      return await this.paymentsTxsService.createMassTransferTxs(createTxs?.amountByAddress);
    } catch (err) {
      if (err instanceof NoDataAvailableError) {
        throw new PreconditionFailedException('No data available. Please run the indexer first.');
      }
      if (err instanceof MissingPrivateKeyError) {
        throw new PreconditionFailedException(err.message);
      }
      throw err;
    }
  }

  @Post('sign-and-send-txs')
  @ApiOkResponse({ type: SignAndSendTxsResponse })
  signAndSendTxs(@Body() txs: SignAndSendTxsRequest): Promise<SignAndSendTxsResponse> {
    try {
      return this.paymentsTxsService.signAndSendTxs(
        txs.massTransferTxs as any as (MassTransferTransaction & WithId & WithProofs)[]
      );
    } catch (err) {
      if (err instanceof MissingPrivateKeyError) {
        throw new PreconditionFailedException(err.message);
      }
      throw err;
    }
  }
}
