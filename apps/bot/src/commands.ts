import { DiscordRequest } from '@bf2-matchmaking/discord';
import { APIApplicationCommand } from 'discord-api-types/v10';

export async function HasGuildCommands(
  appId: string,
  guildId: string,
  commands: Array<Partial<APIApplicationCommand>>
) {
  if (guildId === '' || appId === '') return;

  commands.forEach((c) => HasGuildCommand(appId, guildId, c));
}

// Checks for a command
async function HasGuildCommand(
  appId: string,
  guildId: string,
  command: Partial<APIApplicationCommand>
) {
  // API endpoint to get and post guild commands
  const endpoint = `applications/${appId}/guilds/${guildId}/commands`;

  try {
    const res = await DiscordRequest(endpoint, { method: 'GET' });
    const data = (await res.json()) as Array<Partial<APIApplicationCommand>>;

    if (data) {
      const installedNames = data.map((c) => c['name']);
      // This is just matching on the name, so it's not good for updates
      if (!installedNames.includes(command['name'])) {
        console.log(`Installing "${command['name']}"`);
        InstallGuildCommand(appId, guildId, command);
      } else {
        console.log(`"${command['name']}" command already installed`);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

// Installs a command
export async function InstallGuildCommand(
  appId: string,
  guildId: string,
  command: Partial<APIApplicationCommand>
) {
  // API endpoint to get and post guild commands
  const endpoint = `applications/${appId}/guilds/${guildId}/commands`;
  // install command
  try {
    await DiscordRequest(endpoint, { method: 'POST', body: command });
  } catch (err) {
    console.error(err);
  }
}

export const JOIN_COMMAND: Partial<APIApplicationCommand> = {
  name: 'join',
  description: 'Join a match',
  type: 1,
};

export const LEAVE_COMMAND: Partial<APIApplicationCommand> = {
  name: 'leave',
  description: 'Leave a match',
  type: 1,
};

export const INFO_COMMAND: Partial<APIApplicationCommand> = {
  name: 'info',
  description: 'Get info for channels open match.',
  type: 1,
};

export const PICK_COMMAND: Partial<APIApplicationCommand> = {
  name: 'pick',
  description: 'Leave a match',
  type: 1,
  options: [
    {
      name: 'player',
      description: 'User to be picked',
      type: 1,
    },
  ],
};
