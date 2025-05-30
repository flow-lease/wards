import { INestApplicationContext, LoggerService } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { WardsLogger } from '../src/utils/logger.service';

import { flushLoggerDelay, initLogger } from './common.logger.utils';

export async function handleCommand<T>(
  command: string,
  options: Record<string, any> | undefined,
  action: (logger: LoggerService, app: INestApplicationContext) => Promise<T>
): Promise<void> {
  const logger = initLogger(command, options);
  let exitCode = 0;

  try {
    const app = await getApplicationContext();

    try {
      await action(logger, app);
      logger.log(`Command ${command} executed successfully. Check logs for details.`);
    } catch (err) {
      logger.error(`Execution failed: ${err.message}`, err);
      exitCode = 1;
    } finally {
      await app.close();
    }
  } catch (e) {
    logger.error('ApplicationContext Failed:', e);
    exitCode = 1;
  }

  await flushLoggerDelay();
  process.exit(exitCode);
}

async function getApplicationContext() {
  return await NestFactory.createApplicationContext(AppModule, { logger: new WardsLogger() });
}
