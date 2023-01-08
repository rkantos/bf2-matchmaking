import 'dotenv/config';
import express, { Request } from 'express';
import bodyParser from 'body-parser';
import {
  MatchesRow,
  MatchPlayersRow,
  RoundsRow,
  WEBHOOK_POSTGRES_CHANGES_TYPE,
  WebhookPostgresChangesPayload,
} from '@bf2-matchmaking/supabase';
import {
  error,
  getExpressAccessLogger,
  getExpressErrorLogger,
} from '@bf2-matchmaking/logging';
import { handleDeletedMatch, handleInsertedMatch, handleUpdatedMatch } from './matches';
import {
  handleDeletedMatchPlayer,
  handleInsertedMatchPlayer,
  handleUpdatedMatchPlayer,
} from './match-players';
import { handleInsertedRound } from './rounds';

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(getExpressAccessLogger());

app.post(
  '/matches',
  async (req: Request<{}, {}, WebhookPostgresChangesPayload<MatchesRow>>, res) => {
    try {
      switch (req.body.type) {
        case WEBHOOK_POSTGRES_CHANGES_TYPE.INSERT: {
          handleInsertedMatch(req.body.record);
          break;
        }
        case WEBHOOK_POSTGRES_CHANGES_TYPE.UPDATE: {
          await handleUpdatedMatch(req.body.record, req.body.old_record);
          break;
        }
        case WEBHOOK_POSTGRES_CHANGES_TYPE.DELETE: {
          handleDeletedMatch(req.body.old_record);
          break;
        }
      }
    } catch (e) {
      if (e instanceof Error) {
        error('/matches', e.message);
      } else {
        error('/matches', JSON.stringify(e));
      }
    }
    res.end();
  }
);

app.post(
  '/match_players',
  async (req: Request<{}, {}, WebhookPostgresChangesPayload<MatchPlayersRow>>, res) => {
    try {
      switch (req.body.type) {
        case WEBHOOK_POSTGRES_CHANGES_TYPE.INSERT: {
          await handleInsertedMatchPlayer(req.body.record);
          break;
        }
        case WEBHOOK_POSTGRES_CHANGES_TYPE.UPDATE: {
          await handleUpdatedMatchPlayer(req.body);
          break;
        }
        case WEBHOOK_POSTGRES_CHANGES_TYPE.DELETE: {
          handleDeletedMatchPlayer(req.body.old_record);
          break;
        }
      }
    } catch (e) {
      if (e instanceof Error) {
        error('/match_players', e.message);
      } else {
        error('/match_players', JSON.stringify(e));
      }
    }
    res.end();
  }
);

app.post(
  '/rounds',
  async (req: Request<{}, {}, WebhookPostgresChangesPayload<RoundsRow>>, res) => {
    try {
      switch (req.body.type) {
        case WEBHOOK_POSTGRES_CHANGES_TYPE.INSERT: {
          await handleInsertedRound(req.body.record);
          break;
        }
      }
    } catch (e) {
      if (e instanceof Error) {
        error('/match_players', e.message);
      } else {
        error('/match_players', JSON.stringify(e));
      }
    }
    res.end();
  }
);

app.use(getExpressErrorLogger());
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5004;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`engine listening on port ${PORT}`);
});
