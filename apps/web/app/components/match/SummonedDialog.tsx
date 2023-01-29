import { FC } from 'react';
import { Dialog } from '@headlessui/react';
import { Form, useLoaderData } from '@remix-run/react';
import { loader } from '~/routes/matches/$matchId';
import { usePlayer } from '~/state/PlayerContext';

export const SummonedDialog: FC = () => {
  const { match } = useLoaderData<typeof loader>();
  const { player, isMatchPlayer } = usePlayer();

  if (!player) {
    return null;
  }

  const isSummoned =
    isMatchPlayer(match) && match.teams.some((p) => p.player_id === player.id && !p.ready);

  return (
    <Dialog open={isSummoned} onClose={() => {}}>
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-sm rounded bg-white p-8">
          <Dialog.Title className="text-4xl font-bold mb-4 text-center">
            Match starting
          </Dialog.Title>
          <Form method="post" action={`./players/${player.id}/ready`}>
            <button type="submit" className="ready-button">
              Ready
            </button>
          </Form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};
