import { createLogger, format, transports } from 'winston';
import expressWinston from 'express-winston';

const { combine, timestamp, printf, colorize, json } = format;

const APP_FORMAT = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});
const EXPRESS_FORMAT = printf(({ message, timestamp }) => {
  return `${timestamp} ${message}`;
});
const TRANSPORTS = [new transports.Console()];

const logger = createLogger({
  format: combine(timestamp(), APP_FORMAT, colorize()),
  transports: TRANSPORTS,
});
export const error = (label: string, error: unknown) => {
  if (error instanceof Error) {
    logger.log({ level: 'error', label, message: error.message });
  } else if (typeof error === 'string') {
    logger.log({ level: 'error', label, message: error });
  } else {
    logger.log({ level: 'error', label, message: JSON.stringify(error) });
  }
};
export const warn = (label: string, message: string) =>
  logger.log({ level: 'warn', label, message });
export const info = (label: string, message: string) =>
  logger.log({ level: 'info', label, message });

export const getExpressAccessLogger = () =>
  expressWinston.logger({
    transports: TRANSPORTS,
    format: combine(timestamp(), EXPRESS_FORMAT, colorize()),
    meta: false, // optional: control whether you want to log the meta data about the request (default to true)
    msg: '{{req.method}} {{req.url}} {{res.statusCode}} - - {{res.responseTime}} ms', // optional: customize the default logging message. E.g. "{{res.statusCode}} {{req.method}} {{res.responseTime}}ms {{req.url}}"
    expressFormat: false, // Use the default Express/morgan request formatting. Enabling this will override any msg if true. Will only output colors with colorize set to true
    colorize: true, // Color the text and status code, using the Express/morgan color palette (text: gray, status: default green, 3XX cyan, 4XX yellow, 5XX red).
    ignoreRoute: function (req, res) {
      return false;
    }, // optional: allows to skip some log messages based on request and/or response
  });

/*
 ** Use after router, but before error handler
 */
export const getExpressErrorLogger = () =>
  expressWinston.errorLogger({
    transports: TRANSPORTS,
    format: combine(json(), colorize()),
  });
