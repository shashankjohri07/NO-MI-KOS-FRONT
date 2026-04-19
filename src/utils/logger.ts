export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const LOG_LEVEL_NAMES = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

const currentLogLevel = LogLevel.DEBUG;

function formatTimestamp(): string {
  return new Date().toISOString();
}

function getStackTrace(): string {
  const error = new Error();
  return error.stack || '';
}

function log(level: LogLevel, levelName: string, message: string, data?: unknown): void {
  if (level < currentLogLevel) return;

  const timestamp = formatTimestamp();
  const formattedMessage = `[${timestamp}] [${levelName}] ${message}`;

  const logMethod =
    level === LogLevel.ERROR ? console.error : level === LogLevel.WARN ? console.warn : console.log;

  if (data !== undefined) {
    logMethod(formattedMessage, data);
  } else {
    logMethod(formattedMessage);
  }
}

export const logger = {
  debug(message: string, data?: unknown): void {
    log(LogLevel.DEBUG, LOG_LEVEL_NAMES[LogLevel.DEBUG], message, data);
  },

  info(message: string, data?: unknown): void {
    log(LogLevel.INFO, LOG_LEVEL_NAMES[LogLevel.INFO], message, data);
  },

  warn(message: string, data?: unknown): void {
    log(LogLevel.WARN, LOG_LEVEL_NAMES[LogLevel.WARN], message, data);
  },

  error(message: string, data?: unknown): void {
    log(LogLevel.ERROR, LOG_LEVEL_NAMES[LogLevel.ERROR], message, data);
  },

  getStackTrace(): string {
    return getStackTrace();
  },
};

export default logger;
