var uidFromMention = /<@([0-9]+)>/;

module.exports = {
    lastTime: 0,
    cooldown: 5000,
    permission: {
        group: ["dev", "messages"],
        onlyMonitored: true
    },
    action: function(args, e) {
        if(args[0] == "add") {
            var msg = args.slice(2).join(" ");
            e.db.messages[args[1]] = msg;
            e.bot.sendMessage({
                to: e.channelID,
                message: "<@" + e.userID + "> added `!" + args[1] + "`: " + msg
            });
            e.db.saveConfig();
        } else if(args[0] == "remove") {
            if(!e.db.messages[args[1]]) {
                e.bot.sendMessage({
                    to: e.channelID,
                    message: "<@" + e.userID + "> `!" + args[1] + "` doesn't exist"
                });
                return;
            }
            delete e.db.messages[args[1]];
            e.bot.sendMessage({
                to: e.channelID,
                message: "<@" + e.userID + "> removed `!" + args[1] + "`"
            });
            e.db.saveConfig();
        } else if(args[0] == "list") {
            var str = "**Message list:**\n\n```\nlisting is disabled for now\n```";
            // var g = Object.keys(e.db.messages)
            // for(var i = 0; i < g.length; i++) {
            //     str += "`!" + g[i] + "`\n";
            //     str += e.db.messages[g[i]] + "\n";
            // }

            e.bot.sendMessage({
                to: e.channelID,
                message: str
            });
        }
    }
}
