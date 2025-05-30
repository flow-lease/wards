/* eslint-disable @typescript-eslint/restrict-plus-operands, @typescript-eslint/restrict-template-expressions */
import { LoggerService, LogLevel } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import * as util from 'node:util';
import { format, transports } from 'winston';
import { FileTransportInstance } from 'winston/lib/winston/transports';

const customFormat = format.combine(
  {
    transform(info) {
      const { stack, message } = info;
      //info.context is [...params, label]
      //Handle Error Case
      if (stack && Array.isArray(stack) && stack.length > 0 && Array.isArray(stack[0]) && stack[0].length > 0) {
        if (stack[0].length > 1 && stack[0][0] !== undefined) {
          info.context = [...stack[0]];
        } else {
          info.context = [stack[0][stack[0].length - 1]];
        }
      }

      //Handle params
      if (info.context && Array.isArray(info.context) && info.context.length > 1) {
        const args = info.context.slice(0, info.context.length - 1);
        info.message =
          message +
          ' ' +
          args
            .map((a) =>
              typeof a !== 'string'
                ? util.inspect(a, {
                    depth: null,
                    colors: true,
                  })
                : a
            )
            .join(' ');
      }
      // After extracting args, collapse context to only the label
      if (info.context && Array.isArray(info.context)) {
        info.context = info.context[info.context.length - 1];
      }
      return info;
    },
  },
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.ms(),
  // format.errors({ stack: true }),
  format((info) => {
    info.level = info.level.toUpperCase().padStart(7);
    return info;
  })(),
  format.colorize({ all: true }),
  format.printf(({ level, message, timestamp, context, ms, error }) => {
    if (error) {
      const errorString = util.inspect(error, { depth: null, colors: true });
      return `${timestamp} - ${level} - [${context}] ${message} ${ms}\n${errorString}`;
    }
    return `${timestamp} - ${level} - [${context}] ${message} ${ms}`;
  })
);

export class WardsLogger implements LoggerService {
  private static readonly consoleTransportInstance = new transports.Console({
    format: customFormat,
  });

  private static fileTransportInstance: FileTransportInstance;

  private static getFileTransportInstance(fileSuffix?: string): FileTransportInstance {
    if (!WardsLogger.fileTransportInstance) {
      WardsLogger.fileTransportInstance = new transports.File({
        filename: WardsLogger.buildLogFileName(fileSuffix),
        format: format.combine(customFormat, format.uncolorize()),
      });
    }
    return WardsLogger.fileTransportInstance;
  }

  private static buildLogFileName(fileSuffix?: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileNameParts = ['logs/wards', process.env.PROFILE, timestamp, fileSuffix].filter(Boolean).join('-');
    return `${fileNameParts}.log`;
  }

  readonly loggerService: LoggerService;

  constructor(
    private readonly serviceName?: string,
    private readonly fileSuffix?: string
  ) {
    const logLevel = process.env.LOG_LEVEL === 'debug' ? 'debug' : 'info';
    this.loggerService = WinstonModule.createLogger({
      level: logLevel,
      transports: [WardsLogger.consoleTransportInstance, WardsLogger.getFileTransportInstance(fileSuffix)],
    });
  }

  private appendServiceName(optionalParams: any[]): any[] {
    return this.serviceName ? [...optionalParams, this.serviceName] : optionalParams;
  }

  debug(message: any, ...optionalParams: any[]): any {
    this.loggerService.debug?.(message, this.appendServiceName(optionalParams));
  }

  error(message: any, ...optionalParams: any[]): any {
    this.loggerService.error(message, this.appendServiceName(optionalParams));
  }

  fatal(message: any, ...optionalParams: any[]): any {
    this.loggerService.fatal?.(message, this.appendServiceName(optionalParams));
  }

  log(message: any, ...optionalParams: any[]): any {
    this.loggerService.log(message, this.appendServiceName(optionalParams));
  }

  setLogLevels(levels: LogLevel[]): any {
    this.loggerService.setLogLevels?.(levels);
  }

  verbose(message: any, ...optionalParams: any[]): any {
    this.loggerService.verbose?.(message, this.appendServiceName(optionalParams));
  }

  warn(message: any, ...optionalParams: any[]): any {
    this.loggerService.warn(message, this.appendServiceName(optionalParams));
  }
}
