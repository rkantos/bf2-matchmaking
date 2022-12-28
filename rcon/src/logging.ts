import { createLogger, format, transports } from 'winston';

const { combine, timestamp, printf } = format;

const myFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});
const logger = createLogger({
  format: combine(timestamp(), myFormat),
  transports: [new transports.Console()],
});

export const error = (label: string, message: string) =>
  logger.log({ level: 'error', label, message });
export const warn = (label: string, message: string) =>
  logger.log({ level: 'warn', label, message });
export const info = (label: string, message: string) =>
  logger.log({ level: 'info', label, message });
