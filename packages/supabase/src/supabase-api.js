var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import matches from './matches-api';
export default (function (client) { return (__assign(__assign({}, matches(client)), { getPlayerByUserId: function (userId) {
        return client.from('players').select('*').eq('user_id', userId).single();
    }, getRounds: function () {
        return client
            .from('rounds')
            .select('*, map(*), server(*)');
    }, getServers: function () {
        return client
            .from('servers')
            .select('*, matches(id, status)')
            .or('status.eq.picking,status.eq.started', { foreignTable: 'matches' });
    }, getServerRoundsByTimestampRange: function (serverIp, timestampFrom, timestampTo) {
        return client
            .from('rounds')
            .select('*, map(*), server(*)')
            .gt('created_at', timestampFrom)
            .lt('created_at', timestampTo)
            .eq('server.ip', serverIp);
    } })); });
