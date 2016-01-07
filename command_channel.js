var utils = require("./utils.js");

module.exports = {
    permission: {
        onlyMonitored: true
    },
    action: function(args, e) {
        if(args[0] == "list") {
            var server = utils.findServer(e);
            if(server === false) {
                e.bot.sendMessage({
                    to: e.channelID,
                    message: "Looks like this channel isn't part of a server!"
                });
                return;
            }

            var list = "";
            var channels = Object.keys(e.bot.servers[server].channels);

            for(var i = 0; i < channels.length; i++) {
                if(i) {
                    list += "\n";
                }

                var channel = e.bot.servers[server].channels[channels[i]];

                list += "#" + channel.name + " (" + channel.id + ") - " + channel.type;
            }

            e.bot.sendMessage({
                to: e.channelID,
                message: "List of channels on this server (" + server +"):\n\n```\n" + list + "\n```"
            });
        }
    }
}
