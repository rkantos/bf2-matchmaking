import { ActionArgs, json, LoaderArgs, redirect } from '@remix-run/node';
import invariant from 'tiny-invariant';
import { Form, Link, useLoaderData } from '@remix-run/react';
import { remixClient } from '@bf2-matchmaking/supabase';
import { isOpen, isStarted } from '@bf2-matchmaking/utils';

export const action = async ({ request }: ActionArgs) => {
  const formData = await request.formData();
  const size = parseInt(formData.get('size')?.toString() || '') * 2;
  const pick = formData.get('pick')?.toString();
  const channel = parseInt(formData.get('channel')?.toString() || '');
  invariant(size, 'No size included');
  invariant(pick, 'No pick included');
  const client = remixClient(request);
  const user = await client.getUser();
  const result = await client.createMatch({ pick, size, channel, host: user?.id });
  invariant(result.data, 'Failed to create match');
  return redirect(`/matches/${result.data.id}`);
};

export const loader = async ({ request }: LoaderArgs) => {
  const client = remixClient(request);
  const { data: matches } = await client.getMatches();
  const { data: channels } = await client.getChannelsWithStagingMatches();
  return json({ matches, channels });
};

export default function Index() {
  const { matches, channels } = useLoaderData<typeof loader>();

  return (
    <article className="route flex flex-col gap-4">
      <h1 className="text-2xl">Matches</h1>
      <section className="section">
        <h2 className="text-xl">Create new match</h2>
        <Form className="flex flex-col" method="post" reloadDocument>
          <div className="flex gap-4 my-2">
            <label>
              Team Size:
              <input className="text-field" name="size" />
            </label>
            <label>
              Pick:
              <select className="dropdown" name="pick" defaultValue="captain">
                <option value="captain">Captain mode</option>
                <option value="random">Random pick</option>
              </select>
            </label>
            {channels && (
              <label>
                channel:
                <select className="dropdown" name="channel" defaultValue="">
                  <option value="">None</option>
                  {channels.map((channel) => (
                    <option
                      key={channel.id}
                      value={channel.id}
                      disabled={channel.matches.length !== 0}
                    >
                      {channel.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <button type="submit" className="filled-button max-w-sm">
            Create
          </button>
        </Form>
      </section>
      <section className="section">
        <h2 className="text-2xl">Open matches:</h2>
        <ul className="flex flex-col">
          {matches?.filter(isOpen).map((match) => (
            <li key={match.id}>
              <Link
                className="block border p-2 rounded mb-2"
                to={`/matches/${match.id}`}
              >{`${match.id} - ${match.status} - ${match.created_at}`}</Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="section">
        <h2 className="text-2xl">Previous matches:</h2>
        <ul className="flex flex-col">
          {matches?.filter(isStarted).map((match) => (
            <li key={match.id}>
              <Link
                className="block border p-2 rounded mb-2"
                to={`/matches/${match.id}`}
              >{`${match.id} - ${match.status} - ${match.created_at}`}</Link>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
