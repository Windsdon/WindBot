module.exports = {
    findServer: function(e) {
        var servers = Object.keys(e.bot.servers);
        for(var i = 0; i < servers.length; i++) {
            if(Object.keys(e.bot.servers[servers[i]].channels).indexOf(e.channelID) != -1) {
                return servers[i];
            }
        }

        return false;
    }
}
