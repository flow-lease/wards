import { Command } from 'commander';

import { AppConfigService } from '../src/app.config';

import { handleCommand } from './handle-command.utils';

const program = new Command();

program
  .command('view')
  .description('Get configs of the Indexer')
  .action(async () => {
    await handleCommand('view', undefined, (logger, app) => {
      const configService = app.get(AppConfigService);

      const configResponse = configService.getConfigResponse();

      logger.log('Indexer config:', configResponse);
      return Promise.resolve();
    });
  });

program.parse(process.argv);
