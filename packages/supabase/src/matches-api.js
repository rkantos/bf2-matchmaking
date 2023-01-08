export default (function (client) { return ({
    createMatch: function (values) {
        return client.from('matches').insert([values]).select().single();
    },
    getMatches: function () { return client.from('matches').select('*'); },
    getOpenMatches: function () { return client.from('matches').select('*').eq('status', 'open'); },
    getMatch: function (matchId) {
        return client
            .from('matches')
            .select('*, players(*), maps(*), channel(*), teams:match_players(player_id, team, captain), server(*)')
            .eq('id', matchId)
            .single();
    },
    updateMatch: function (matchId, values) {
        return client.from('matches').update(values).eq('id', matchId);
    },
    createMatchPlayer: function (match_id, player_id) {
        return client.from('match_players').insert([{ match_id: match_id, player_id: player_id }]);
    },
    deleteMatchPlayer: function (matchId, playerId) {
        return client
            .from('match_players')["delete"]()
            .eq('match_id', matchId)
            .eq('player_id', playerId);
    },
    updateMatchPlayer: function (matchId, playerId, values) {
        return client
            .from('match_players')
            .update(values)
            .eq('match_id', matchId)
            .eq('player_id', playerId);
    },
    createMatchMaps: function (match_id) {
        var maps = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            maps[_i - 1] = arguments[_i];
        }
        return client.from('match_maps').insert(maps.map(function (mapId) { return ({ match_id: match_id, map_id: mapId }); }));
    },
    getStartedMatchesByServer: function (serverIp) {
        return client.from('matches').select('*').eq('status', 'started').eq('server', serverIp);
    }
}); });
