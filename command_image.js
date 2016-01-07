var uidFromMention = /<@([0-9]+)>/;
var fs = require("fs");
var http = require("http");

module.exports = {
    permission: {
        group: ["dev"]
    },
    action: function(args, e) {
        if(!args[0]) {
            e.bot.sendMessage({
                to: e.channelID,
                message: "<@" + e.userID + "> usage: `!image <add|remove>`"
            });
            return;
        }
        if(args[0] == "add") {
            if(args.length < 3) {
                e.bot.sendMessage({
                    to: e.channelID,
                    message: "<@" + e.userID + "> usage: `!image add <id> <imgur>`"
                });
                return;
            }
            if(!/^[0-9A-Za-z]+\.(gif|png|jpg)$/.test(args[2])) {
                e.bot.sendMessage({
                    to: e.channelID,
                    message: "<@" + e.userID + "> that image name doesn't look valid!"
                });
                return;
            }
            var filename = "./media/images/" + args[2];
            var file = fs.createWriteStream(filename);
            var url = "http://i.imgur.com/" + args[2];
            e.db.images[args[1]] = filename;
            var request = http.get(url, function(response) {
              response.pipe(file);
            });

            e.bot.sendMessage({
                to: e.channelID,
                message: "<@" + e.userID + "> add `!" + args[1] + "`"
            });

            e.db.saveConfig();
        } else if(args[0] == "remove") {
            if(args.length < 2) {
                e.bot.sendMessage({
                    to: e.channelID,
                    message: "<@" + e.userID + "> usage: `!image remove <id>`"
                });
                return;
            }
            if(!e.db.images[args[1]]) {
                e.bot.sendMessage({
                    to: e.channelID,
                    message: "<@" + e.userID + "> no such image!"
                });
                return;
            }
            delete e.db.images[args[1]];
            e.db.saveConfig();
        } else if(args[0] == "list") {
            var str = "**Image list:**\n\n```\nlisting is disabled for now\n```";
            // var g = Object.keys(e.db.images)
            // for(var i = 0; i < g.length; i++) {
            //     str += "`!" + g[i] + "`\n";
            // }

            e.bot.sendMessage({
                to: e.channelID,
                message: str
            });
        }
    }
}
