/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { LoggerService } from '@nestjs/common';
import { MassTransferTransaction } from '@waves/ts-types';
import { WithId, WithProofs } from '@waves/waves-transactions';
import { Command } from 'commander';
import * as fs from 'fs';

import { PaymentsPayableService } from '../src/payments-payable/payments-payable.service';
import { PaymentsTxsService } from '../src/payments-payable/payments-txs.service';

import { handleCommand } from './handle-command.utils';

const program = new Command();

program
  .command('summary')
  .description('Get payments payable summary')
  .option('-o, --output <path>', 'File path to save the summary as JSON')
  .action(async (options) => {
    await handleCommand('summary', options, async (logger, app) => {
      const payableService = app.get(PaymentsPayableService);

      const summary = await payableService.getSummaryData();

      logger.log('Payments summary:', summary);

      await writeResultToFile(logger, options.output, summary);
    });
  });

program
  .command('create-txs')
  .description('Create mass transfer transactions from provided or summary data')
  .option('-f, --file <path>', 'JSON file with amountByAddress mapping')
  .option('-o, --output <path>', 'File path to save transfer transactions as JSON')
  .action(async (options) => {
    await handleCommand('create-txs', options, async (logger, app) => {
      const txsService = app.get(PaymentsTxsService);

      let amountByAddress: Record<string, string> | undefined;

      if (options.file) {
        try {
          amountByAddress = JSON.parse(await fs.promises.readFile(options.file, 'utf-8')).debt;
        } catch (err) {
          logger.error(`Failed to read file ${options.file}: ${err.message}`);
          throw err;
        }
      }

      const txs = await txsService.createMassTransferTxs(amountByAddress);
      logger.log('Created transactions:', txs);

      await writeResultToFile(logger, options.output, txs);
    });
  });

program
  .command('sign-and-send-txs')
  .description('Sign and send mass transfer transactions from provided or create-txs data')
  .requiredOption('-f, --file <path>', 'JSON file with massTransferTxs array')
  .option('-o, --output <path>', 'File path to save result as JSON')
  .action(async (options) => {
    await handleCommand('sign-and-send-txs', options, async (logger, app) => {
      const txsService = app.get(PaymentsTxsService);

      let txs: { massTransferTxs: (MassTransferTransaction & WithId & WithProofs)[] };

      if (options.file) {
        try {
          txs = JSON.parse(await fs.promises.readFile(options.file, 'utf-8'));
        } catch (err) {
          logger.error(`Failed to read file ${options.file}: ${err.message}`);
          throw err;
        }
      } else {
        logger.log('No input file provided, using create-txs...');
        txs = await txsService.createMassTransferTxs();
      }

      const result = await txsService.signAndSendTxs(txs.massTransferTxs);
      logger.log('SignAndSendTxs result:', result);

      await writeResultToFile(logger, options.output, result);
    });
  });

async function writeResultToFile(logger: LoggerService, outputPath: string | undefined, result: any) {
  if (outputPath) {
    try {
      await fs.promises.writeFile(outputPath, JSON.stringify(result, null, 2), 'utf-8');
      logger.log(`Result saved to ${outputPath}`);
    } catch (err) {
      logger.error(`Failed to write result to file ${outputPath}: ${err.message}`);
      throw err;
    }
  }
}

program.parse(process.argv);
