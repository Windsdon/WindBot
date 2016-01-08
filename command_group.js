var uidFromMention = /<@([0-9]+)>/;

module.exports = {
    permission: {
        uid: ["114855677482106888"],
        group: ["dev"],
        onlyMonitored: true
    },
    action: function(args, e) {
        if(args[0] == "add") {
            if(!uidFromMention.test(args[2])) {
                e.bot.sendMessage({
                    to: e.channelID,
                    message: "<@" + e.userID + "> that's not a valid mention!"
                });
                return;
            }
            var group = args[1];
            var user = uidFromMention.exec(args[2])[1];

            if(e.db.groups[group]) {
                if(e.db.isUserInGroup(user, group)) {
                    e.bot.sendMessage({
                        to: e.channelID,
                        message: "<@" + e.userID + "> user " + args[2] + " (" + user + ")  already in group `" + group + "`"
                    });
                    return;
                }
            } else {
                e.bot.sendMessage({
                    to: e.channelID,
                    message: "<@" + e.userID + "> no group `" + group + "`"
                });
                return;
            }

            e.db.groups[group].push(user);

            e.bot.sendMessage({
                to: e.channelID,
                message: "<@" + e.userID + "> user " + args[2] + " (" + user + ")  added to `" + group + "`"
            });

            e.db.saveConfig();
        } else if(args[0] == "remove") {
            if(!uidFromMention.test(args[2])) {
                e.bot.sendMessage({
                    to: e.channelID,
                    message: "<@" + e.userID + "> that's not a valid mention!"
                });
                return;
            }
            var group = args[1];
            var user = uidFromMention.exec(args[2])[1];

            if(e.db.groups[group]) {
                if(!e.db.isUserInGroup(user, group)) {
                    e.bot.sendMessage({
                        to: e.channelID,
                        message: "<@" + e.userID + "> user " + args[2] + " (" + user + ")  is not in group `" + group + "`"
                    });
                    return;
                }
            } else {
                e.bot.sendMessage({
                    to: e.channelID,
                    message: "<@" + e.userID + "> no group `" + group + "`"
                });
                return;
            }

            e.db.groups[group].splice(e.db.groups[group].indexOf(user), 1);

            e.bot.sendMessage({
                to: e.channelID,
                message: "<@" + e.userID + "> user " + args[2] + " (" + user + ")  removed from `" + group + "`"
            });

            e.db.saveConfig();
        } else if(args[0] == "debug") {
            console.log(e.db.groups);
        } else if(args[0] == "list") {
            var str = "**Group list:**\n\n";
            var g = Object.keys(e.db.groups)
            for(var i = 0; i < g.length; i++) {
                str += "`" + g[i] + "`: "
                for(j = 0; j < e.db.groups[g[i]].length; j++) {
                    str += " <@" + e.db.groups[g[i]][j] + ">";
                }
                str += "\n";
            }

            e.bot.sendMessage({
                to: e.channelID,
                message: str
            });
        }
    }
}
