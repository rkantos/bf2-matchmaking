export enum ApiErrorType {
  NotVoiceChannel = 'NOT_VOICE_CHANNEL',
  NoMatchStagingChannel = 'NO_MATCH_STAGING_CHANNEL',
  NoMatchDiscordChannel = 'NO_MATCH_DISCORD_CHANNEL',
}

export class ApiError extends Error {
  status: number;
  constructor(type: ApiErrorType) {
    super(type);
    switch (type) {
      case ApiErrorType.NoMatchStagingChannel:
      case ApiErrorType.NotVoiceChannel:
      case ApiErrorType.NoMatchDiscordChannel:
        this.status = 400;
        break;
      default:
        this.status = 500;
    }
  }
}

export enum MatchEvent {
  Summon = 'Summon',
  Draft = 'Draft',
}

export interface PostMatchEventRequestBody {
  event: MatchEvent;
  matchId: number;
}
