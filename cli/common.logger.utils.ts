import { LoggerService } from '@nestjs/common';

import { WardsLogger } from '../src/utils/logger.service';

export function initLogger(command: string, options?: Record<string, any>): LoggerService {
  const logger = new WardsLogger('CLI', command);
  logLaunchingMsg(logger, command, options);
  return logger;
}

function logLaunchingMsg(logger: LoggerService, command: string, options?: Record<string, any>) {
  if (options === undefined) {
    logger.log(`cmd: ${command}`);
  } else {
    logger.log(`cmd: ${command}, options:`, options);
  }
  logger.log('Launching context...');
}

export async function flushLoggerDelay() {
  await new Promise((resolve) => setTimeout(resolve, 3000));
}
