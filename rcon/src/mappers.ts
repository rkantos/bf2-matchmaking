export interface ServerInfo {
  version: string;
  currentGameStatus: string;
  maxPlayers: string;
  connectedPlayers: string;
  joiningPlayers: string;
  currentMapName: string;
  nextMapName: string;
  serverName: string;

  team1_Name: string;
  team1_TicketState: string;
  team1_startTickets: string;
  team1_tickets: string;
  team1_null: string;

  team2_Name: string;
  team2_TicketState: string;
  team2_startTickets: string;
  team2_tickets: string;
  team2_null: string;

  roundTime: string;
  timeLeft: string;
  gameMode: string;
  modDir: string;
  worldSize: string;
  timeLimit: string;
  autoBalanceTeam: string;
  ranked: string;
  team1: string;
  team2: string;
  wallTime: string;
  reservedSlots: string;
}
export const mapServerInfo = (data: string) => {
  const array = data.split('\t');
  return {
    reservedSlots: array[29],
    wallTime: array[28],
    team2: array[27],
    team1: array[26],
    ranked: array[25],
    autoBalanceTeam: array[24],
    timeLimit: array[23],
    worldSize: array[22],
    modDir: array[21],
    gameMode: array[20],
    timeLeft: array[19],
    roundTime: array[18],
    team2_null: array[17],
    team2_tickets: array[16],
    team2_startTickets: array[15],
    team2_TicketState: array[14],
    team2_Name: array[13],
    team1_null: array[12],
    team1_tickets: array[11],
    team1_startTickets: array[10],
    team1_TicketState: array[9],
    team1_Name: array[8],
    serverName: array[7],
    nextMapName: array[6],
    currentMapName: array[5],
    joiningPlayers: array[4],
    connectedPlayers: array[3],
    maxPlayers: array[2],
    currentGameStatus: array[1],
    version: array[0],
  };
};
