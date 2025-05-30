/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { LoggerService } from '@nestjs/common';
import { Command } from 'commander';

import { IndexerService } from '../src/indexer/indexer.service';

import { handleCommand } from './handle-command.utils';

const program = new Command();

program
  .command('init')
  .description('Initialize indexing from a specific block')
  .requiredOption('-f, --from <number>', 'Start block number', parseInt)
  .action(async (options) => {
    await handleCommand('init', options, async (logger, app) => {
      const indexerService = app.get(IndexerService);

      await indexerService.init(options.from);
    });
  });

program
  .command('status')
  .description('Get Status of the Indexer')
  .action(async () => {
    await handleCommand('status', undefined, async (logger, app) => {
      const indexerService = app.get(IndexerService);

      const indexerStatusDetails = await indexerService.getStatus();

      logger.log('Indexer Status:', indexerStatusDetails);
    });
  });

program
  .command('index')
  .description('Start indexing process')
  .option('-t, --to <number>', 'End block number', parseInt)
  .action(async (options) => {
    await handleCommand('index', options, async (logger, app) => {
      const indexerService = app.get(IndexerService);
      const { processedFrom, processedTo: initProcessedTo } = await indexerService.getStatus();

      logger.log('Indexing...');
      await indexerService.startIndexing(options.to);

      await monitorIndexingProgress(logger, indexerService, initProcessedTo ?? processedFrom!, 'Indexing');
    });
  });

program
  .command('reindex')
  .description('Reindex from a specific block')
  .requiredOption('-f, --from <number>', 'Start block number', parseInt)
  .option('-t, --to <number>', 'End block number', parseInt)
  .action(async (options) => {
    await handleCommand('reindex', options, async (logger, app) => {
      const indexerService = app.get(IndexerService);

      logger.log(`Reindexing from block ${options.from} ${options.to ? 'to ' + options.to : ''}`);
      await indexerService.startReindexing(options.from, options.to);

      await monitorIndexingProgress(logger, indexerService, options.from, 'Reindexing');
    });
  });

async function monitorIndexingProgress(
  logger: LoggerService,
  indexerService: IndexerService,
  from: number,
  action: 'Reindexing' | 'Indexing'
) {
  logger.log(`${action} started, waiting for completion...`);

  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Poll every 5s

    const { status: statusText, processedTo, targetTo } = await indexerService.getStatus();

    let progress = '0.00';

    if (processedTo) {
      const blocksToIndex = targetTo - from;
      const indexed = processedTo - from;
      progress = ((indexed / blocksToIndex) * 100).toFixed(2);
    }

    if (statusText === 'ready') {
      logger.log(`${action} complete. Exiting...`);
      break;
    }

    logger.log(
      `${action} progress: ${processedTo ?? 'N/A'} / ${targetTo} blocks (${progress}%) | status: ${statusText}`
    );
  }
}

program.parse(process.argv);
