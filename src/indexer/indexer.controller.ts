import {
  BadRequestException,
  Controller,
  Get,
  ParseIntPipe,
  Post,
  PreconditionFailedException,
  Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiQuery } from '@nestjs/swagger';

import { IndexerStartResponse } from './dto/indexer-start-response.dto';
import { IndexerStatusDetailsResponse } from './dto/indexer-status-details-response.dto';
import { FromBlockNotFoundError, IndexerService, IndexerValidationError } from './indexer.service';

@Controller('indexer')
export class IndexerController {
  constructor(private readonly indexerService: IndexerService) {}

  @Post('init')
  @ApiQuery({
    name: 'from',
    required: true,
    type: Number,
    description: 'Start block number. Required before the very first indexing launch.',
  })
  @ApiCreatedResponse()
  async initIndexing(@Query('from', new ParseIntPipe({ errorHttpStatusCode: 400 })) from: number): Promise<void> {
    if (from <= 0) throw new BadRequestException('"from" must be a positive integer');
    try {
      await this.indexerService.init(from);
    } catch (err) {
      if (err instanceof IndexerValidationError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }

  @Get('status')
  @ApiOkResponse({ type: IndexerStatusDetailsResponse })
  async getStatus(): Promise<IndexerStatusDetailsResponse> {
    return await this.indexerService.getStatus();
  }

  @Post('start')
  @ApiQuery({
    name: 'to',
    required: false,
    type: Number,
    description: 'Optional end block number.',
  })
  @ApiCreatedResponse({ type: IndexerStartResponse })
  async startIndexing(
    @Query('to', new ParseIntPipe({ optional: true, errorHttpStatusCode: 400 })) to?: number
  ): Promise<IndexerStartResponse> {
    if (to !== undefined && to <= 0) throw new BadRequestException('"to" must be a positive integer');
    try {
      return await this.indexerService.startIndexing(to);
    } catch (err) {
      if (err instanceof FromBlockNotFoundError) {
        throw new PreconditionFailedException('You must provide "from" using /index/init');
      }
      if (err instanceof IndexerValidationError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }

  @Post('reindex')
  @ApiQuery({
    name: 'from',
    required: true,
    type: Number,
    description: 'Start reindex block number.',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    type: Number,
    description: 'Optional end block number.',
  })
  @ApiCreatedResponse({ type: IndexerStartResponse })
  async startReindexing(
    @Query('from', new ParseIntPipe({ errorHttpStatusCode: 400 })) from: number,
    @Query('to', new ParseIntPipe({ optional: true, errorHttpStatusCode: 400 })) to?: number
  ): Promise<IndexerStartResponse> {
    if (from <= 0) throw new BadRequestException('"from" must be a positive integer');
    if (to !== undefined && to < from) throw new BadRequestException('"to" must be greater or equals "from"');
    try {
      return await this.indexerService.startReindexing(from, to);
    } catch (err) {
      if (err instanceof IndexerValidationError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }
}
