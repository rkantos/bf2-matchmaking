import moment from 'moment/moment';

/**
 *
 * @param target ISO 8601 date format
 */
export const getTimeLeft = (target: string) =>
  moment.duration(moment(target).diff(moment()));

export const getDurationString = (duration: moment.Duration) =>
  `${duration.minutes().toString().padStart(2, '0')}:${duration
    .seconds()
    .toString()
    .padStart(2, '0')}`;
