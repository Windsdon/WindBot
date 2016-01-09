var fs = require("fs");
var DiscordClient = require('discord.io');
var config = require("./config.json");
var Vote = require("./vote");
var Tracker = require("./tracker");
var http = require("http");
var consolere = require('console-remote-client').connect('console.re','80','windbot');

var bot;

var votes = [];

var database = new (require("./database.js"))();
var away = [];

var uidFromMention = /<@([0-9]+)>/;

var startTime = (new Date()).getTime();

var masterID = "114855677482106888";

var commands = {
    channel: require("./command_channel.js"),
    help: {
        permission: {
            uid: ["114855677482106888"],
            group: ["dev"],
            onlyMonitored: true
        },
        action: function(args, e) {
            var cmds = Object.keys(commands);
            var cmdlist = "* !" + cmds.join("\n* !");
            e.bot.sendMessage({
                to: e.channelID,
                message: "```\nBeep boop, I'm a bot!\n\nCommands:\n" + cmdlist + "```"
            });
            e.re.log(e.user + " asked for help, sent a list of commands ");
        }

    },
    ping: {
        permission: {
            uid: ["114855677482106888"],
            group: ["dev"],
            onlyMonitored: true
        },
        action: function(args, e) {
            e.bot.sendMessage({
                to: e.channelID,
                message: "pong"
            });
            e.re.log(e.user + " pinged me!");
        }
    },
    myid: {
        permission: {
            group: ["dev"],
            onlyMonitored: true
        },
        action: function(args, e) {
            e.bot.sendMessage({
                to: e.channelID,
                message: "<@" + e.userID + ">, your ID is " + e.userID
            });
            e.re.log(e.user + " asked for his id, which was "+ e.userID);
        }
    },
    id: {
        permission: {
            group: ["dev"],
            onlyMonitored: true
        },
        action: function(args, e) {
            if(!args[0] || !uidFromMention.test(args[0])) {
                return;
            }

            var uid = uidFromMention.exec(args[0])[1];
            e.bot.sendMessage({
                to: e.channelID,
                message: "<@" + e.userID + "> " + uid
            })
            e.re.log(e.user + " asked for annother users id, which was "+ uid);
        }
    },
    votestart: {
        permission: {
            group: ["votemakers", "dev"],
            onlyMonitored: true
        },
        action: function(args, e) {
            if(votes[e.channelID]) {
                e.bot.sendMessage({
                    to: e.channelID,
                    message: "<@" + e.userID + "> another poll already in progress! End it with  `!voteend`"
                });
                e.re.log(e.user + " tried to start a poll, buts a poll is already running! ");
                return;
            };
            if(args.length == 0) {
                e.bot.sendMessage({
                    to: e.channelID,
                    message: "<@" + e.userID + "> can't start an empty poll!"
                });
                e.re.log(e.user + " tried to start an empty poll!");
                return;
            }
            if(args.indexOf("%") == -1) {
                var opts = args;
                var title = "";
            } else {
                var title = "\n\n**" + args.slice(0, args.indexOf("%")).join(" ") + "**\n";
                var opts = args.slice(args.indexOf("%") + 1);
            }
            votes[e.channelID] = new Vote(opts, title);
            var pollopts = votes[e.channelID].optionsString();
            e.bot.sendMessage({
                to: e.channelID,
                message: "<@" + e.userID + "> started a poll. Vote with `!vote <option number>`." + title + "\nOptions are:\n ```\n" + pollopts + "\n```"
            });
            e.re.log(e.user + " started poll: "+ title);
        }
    },
    vote: {
        permission: {
            onlyMonitored: true
        },
        action: function(args, e) {
            if(!votes[e.channelID]) {
                return;
            }
            if(!args.length) {
                return;
            }
            console.log("User voting", votes[e.channelID].vote(e.userID, args[0]));
        }
    },
    voteremind: {
        permission: {
            group: ["votemakers", "dev"],
            onlyMonitored: true
        },
        action: function(args, e) {
            if(!votes[e.channelID]) {
                return;
            }

            e.bot.sendMessage({
                to: e.channelID,
                message: "<@" + e.userID + "> started a poll. Vote with `!vote <option number>`." + votes[e.channelID].title + "\nOptions are:\n ```\n" + votes[e.channelID].optionsString() + "\n```"
            });
            e.re.log(e.user + " reminded people to vote!");
        }
    },
    voteend: {
        permission: {
            group: ["votemakers", "dev"],
            onlyMonitored: true
        },
        action: function(args, e) {
            console.log("Finish vote!");
            if(!votes[e.channelID]) {
                console.log("Not running");
                e.bot.sendMessage({
                    to: e.channelID,
                    message: "<@" + e.userID + "> no polls running!"
                });
                return;
            }
            var pollresult = votes[e.channelID].getVotesString();
            console.log("Results: " + pollresult);
            e.bot.sendMessage({
                to: e.channelID,
                message: "Poll ended! Results:\n**" + votes[e.channelID].title + "**\n ```\n" + pollresult + "\n```"
            });
            e.re.log(e.user + " ended poll: " + votes[e.channelID].title + " with result: \n" + pollresult);
            delete votes[e.channelID];
        }
    },
    group: require("./command_group.js"),
    kill: {
        permission: {
            uid: ["114855677482106888"]
        },
        action: function(args, e) {
            e.bot.sendMessage({
                to: e.channelID,
                message: "You monster >.<"
            });
            e.re.log(e.user + " killed me.");
            process.exit(0);
        }
    },
    restart: {
        permission: {
            uid: ["114855677482106888"]
        },
        action: function(args, e) {
            e.re.log(e.user + " is restarting me!");
            restart();
        }
    },
    message: require("./command_message.js"),
    say: {
        permission: {
            uid: ["114855677482106888"],
            group: ["dev"],
            onlyMonitored: true
        },
        action: function(args, e) {
            e.bot.sendMessage({
                to: e.channelID,
                message: args.join(" ")
            });
            e.re.log(e.user + " made me say: " + args.join(" "));
        }
    },
    join: {
        permission: {
            group: ["dev"],
            onlyMonitored: true
        },
        action: function(args, e) {
            e.bot.acceptInvite(args[0]);
        }
    },
    track: {
        permission: {
            group: ["dev"],
            onlyMonitored: true
        },
        action: function(args, e) {
            if(args[0] == "start") {
                e.bot.sendMessage({
                    to: e.channelID,
                    message: "Message tracking started!"
                });
                e.re.log(e.user + " started message tracking!");
            }
        }
    },
    status: {
        permission: {
            group: ["dev"],
            onlyMonitored: true
        },
        action: function(args, e) {
            var t = Math.floor(((new Date()).getTime() - startTime) / 1000);
            e.bot.sendMessage({
                to: e.channelID,
                message: "I've been running for `" + t + " seconds`"
            });
            e.re.log(e.user + " asked for my status, i´ve been running: " + t + " seconds`");
        }
    },
    enable: {
        permission: {
            group: ["dev"],
            onlyMonitored: false
        },
        action: function(args, e) {
            if(e.db.channels.indexOf(e.channelID) != -1) {
                e.bot.sendMessage({
                    to: e.channelID,
                    message: "I'm already here >.<"
                });
                return;
            }
            e.db.channels.push(e.channelID);
            e.bot.sendMessage({
                to: e.channelID,
                message: "I will now monitor this channel :D"
            });
            e.re.log(e.user + " made me monitor " + e.channel);
            e.db.saveConfig();
        }
    },
    disable: {
        permission: {
            group: ["dev"],
            onlyMonitored: true
        },
        action: function(args, e) {
            if(e.db.channels.indexOf(e.channelID) == -1) {
                return;
            }
            e.db.channels.splice(e.db.channels.indexOf(e.channelID), 1);
            e.db.saveConfig();
            e.bot.sendMessage({
                to: e.channelID,
                message: "I will no longer monitor this channel :("
            });
            e.re.log(e.user + " made me stop monitoring " + e.channel);
        }
    },
    roll: {
        permission: {
            onlyMonitored: true
        },
        action: function(args, e) {
            var sides = 6;
            if(args[0]) {
                var sides = parseInt(args[0]);
            }
            var num = Math.ceil(Math.random() * sides);
            e.bot.sendMessage({
                to: e.channelID,
                message: "<@" + e.userID + "> rolled a " + num
            });
            e.re.log(e.user + " rolled: " + num);
        }
    },
    pass: {
        permission: {
            onlyMonitored: true
        },
        action: function(args, e) {
            if(args[0] && e.db.passes[args[0]]) {
                e.bot.sendMessage({
                    to: e.channelID,
                    message: e.db.passes[args[0]]
                });
            }
        }
    },
    image: require("./command_image.js"),
    playing: {
        permission: {
            group: ["dev"],
            onlyMonitored: true
        },
        action: function(args, e) {
            e.bot.setPresence({
                game: args.join(" ")
            })
        }
    },
    reddit: {
        permission: {
            onlyMonitored: true
        },
        action: function(args, e) {

        }
    },
    rights: {
        permission: {
            onlyMonitored: true
        },
        action: function(args, e) {
            var subject = e.userID;
            if(args[0]) {
                subject = uidFromMention.exec(args[0])[1];
            }
            var str = "<@" + subject + ">'s groups: ";
            var g = Object.keys(e.db.groups)
            for(var i = 0; i < g.length; i++) {
                if(e.db.isUserInGroup(subject, g[i])) {
                    str += " `"+g[i]+"` ";
                }
            }

            e.bot.sendMessage({
                to: e.channelID,
                message: str
            });
        }
    },
    audio: require("./command_audio.js"),
    callme: {
        permission: {
            group: ["dev"],
            onlyMonitored: true
        },
        action: function(args, e) {
            if(!args[0]) {
                e.db.config.calling = "!";
                e.db.saveConfig();
                return;
            }
            if(args[1]) {
                e.db.config.calling = args[0];
            } else {
                e.db.config.calling = args[0] + " ";
            }
            e.db.saveConfig();
        }
    }

}

function restart() {
    if(bot) {
        bot.disconnect();
    }

    bot = new DiscordClient({
        autorun: true,
        token: database.config.token
    });

    bot.on('ready', function() {
        console.log(bot.username + " - (" + bot.id + ")");
    });

    bot.on('message', processMessage);
    console.log(database);
}

function processMessage(user, userID, channelID, message, rawEvent) {
    console.log("Got message " + message.replace(/[^A-Za-z0-9 ]/, '?') + " on channel "
    + channelID.replace(/[^A-Za-z0-9 ]/, '?')  + " from " + user
    + " (" + userID.replace(/[^A-Za-z0-9 ]/, '?')  + ")");

    if(userID == bot.id) {
        return;
    }

    var parsed = parse(message);
    if(!parsed) {
        console.log("Not a command");
        return;
    }

    if(parsed.command == "eval") {
        if(userID != masterID) {
            bot.sendMessage({
                to: channelID,
                message: "<@" + userID + "> Only Windsdon can use that command!"
            });
            return;
        }
        try {
            bot.sendMessage({
                to: channelID,
                message: "```" + eval(message.substring(database.config.calling.length).substring(message.indexOf(" "))) + "```"
            });
        } catch(e) {
            bot.sendMessage({
                to: channelID,
                message: "Something went wrong! \n\n```" + e.message + "```"
            });
        }
    }

    if(!canUserRun(parsed.command, userID, channelID)) {
        console.log("User cant run this command");
        return;
    }

    if(commands[parsed.command]) {
        if(commands[parsed.command].cooldown) {
            if((new Date()).getTime() - commands[parsed.command].lastTime < commands[parsed.command].cooldown) {
                bot.sendMessage({
                    to: channelID,
                    message: "<@" + userID + "> you are doing that too fast!"
                });
                return;
            }
            commands[parsed.command].lastTime = (new Date()).getTime();
        }
        commands[parsed.command].action(parsed.args, {
            "user": user,
            "userID": userID,
            "channelID": channelID,
            "event": rawEvent,
            "bot": bot,
            "db": database,
            "re": console.re
        });
    } else {
        if(database.messages[parsed.command]) {
            bot.sendMessage({
                to: channelID,
                message: database.messages[parsed.command]
            });
            return;
        }
        if(database.images[parsed.command]) {
            bot.uploadFile({
                to: channelID,
                file: fs.createReadStream(database.images[parsed.command])
            })
        }
    }
}

function canUserRun(command, uid, channelID) {
    if(!commands[command]) {
        if(database.channels.indexOf(channelID) == -1) {
            return false;
        }
        if(database.messages[command]) {
            return true;
        }
        if(database.images[command]) {
            return true;
        }
        return false;
    }

    if(!commands[command].permission) {
        if(database.channels.indexOf(channelID) != -1){
            return true;
        } else {
            return false;
        }
    }

    if(commands[command].permission.onlyMonitored) {
        if(database.channels.indexOf(channelID) == -1){
            return false;
        }
    }

    if(!commands[command].permission.uid && !commands[command].permission.group) {
        return true;
    }

    if(commands[command].permission.uid) {
        for(var i = 0; i < commands[command].permission.uid.length; i++) {
            if(uid == commands[command].permission.uid[i]) {
                return true;
            }
        }
    }

    if(commands[command].permission.group) {
        for(var i = 0; i < commands[command].permission.group.length; i++) {
            if(database.isUserInGroup(uid, commands[command].permission.group[i])) {
                return true;
            }
        }
    }

    return false;
}

function parse(string) {
    if(string.indexOf(database.config.calling) != 0) {
        return false;
    }
    string = string.substring(database.config.calling.length);
    var pieces = string.split(" ");
    //pieces[0] = pieces[0].slice(1, pieces[0].length);

    return {
        command: pieces[0],
        args: pieces.slice(1, pieces.length)
    };
}

restart();
