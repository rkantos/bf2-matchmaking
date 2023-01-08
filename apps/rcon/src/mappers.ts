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
export const mapServerInfo = (data?: string): ServerInfo | null => {
  if (!data) {
    return null;
  }
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

export interface PlayerInfo {
  index: string;
  getName: string;
  getTeam: string;
  getPing: string;
  isConnected: string;
  isValid: string;
  isRemote: string;
  isAIPlayer: string;
  isAlive: string;
  isManDown: string;
  getProfileId: string;
  isFlagHolder: string;
  getSuicide: string;
  getTimeToSpawn: string;
  getSquadId: string;
  isSquadLeader: string;
  isCommander: string;
  getSpawnGroup: string;
  getAddress: string;
  scoreDamageAssists: string;
  scorePassengerAssists: string;
  scoreTargetAssists: string;
  scoreRevives: string;
  scoreTeamDamages: string;
  scoreTeamVehicleDamages: string;
  scoreCpCaptures: string;
  scoreCpDefends: string;
  scoreCpAssists: string;
  scoreCpNeutralizes: string;
  scoreCpNeutralizeAssists: string;
  scoreSuicides: string;
  scoreKills: string;
  scoreTKs: string;
  vehicleType: string;
  kitTemplateName: string;
  kiConnectedAt: string;
  deaths: string;
  score: string;
  vehicleName: string;
  rank: string;
  position: string;
  idleTime: string;
  keyhash: string;
  punished: string;
  timesPunished: string;
  timesForgiven: string;
}

export const mapListPlayers = (data?: string): Array<PlayerInfo> | null =>
  data
    ? data
        .split(/(\r\n|\r|\n)/)
        .filter((text) => Boolean(text.trim()))
        .map((playerData) => {
          const array = playerData.split('\t');
          return {
            index: array[0],
            getName: array[1],
            getTeam: array[2],
            getPing: array[3],
            isConnected: array[4],
            isValid: array[5],
            isRemote: array[6],
            isAIPlayer: array[7],
            isAlive: array[8],
            isManDown: array[9],
            getProfileId: array[10],
            isFlagHolder: array[11],
            getSuicide: array[12],
            getTimeToSpawn: array[13],
            getSquadId: array[14],
            isSquadLeader: array[15],
            isCommander: array[16],
            getSpawnGroup: array[17],
            getAddress: array[18],
            scoreDamageAssists: array[19],
            scorePassengerAssists: array[20],
            scoreTargetAssists: array[21],
            scoreRevives: array[22],
            scoreTeamDamages: array[23],
            scoreTeamVehicleDamages: array[24],
            scoreCpCaptures: array[25],
            scoreCpDefends: array[26],
            scoreCpAssists: array[27],
            scoreCpNeutralizes: array[28],
            scoreCpNeutralizeAssists: array[29],
            scoreSuicides: array[30],
            scoreKills: array[31],
            scoreTKs: array[32],
            vehicleType: array[33],
            kitTemplateName: array[34],
            kiConnectedAt: array[35],
            deaths: array[36],
            score: array[37],
            vehicleName: array[38],
            rank: array[39],
            position: array[40],
            idleTime: array[41],
            keyhash: array[42],
            punished: array[43],
            timesPunished: array[44],
            timesForgiven: array[45],
          };
        })
    : null;
