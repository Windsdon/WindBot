var fs = require("fs");
var DiscordClient = require('discord.io');
var config = require("./config.json");
var Vote = require("./vote");
var Tracker = require("./tracker");

var bot;

var votes = [];

var groups = require("./groups.json");
var messages = require("./messages.json");
var channels = require("./channels.json");
var away = [];

var uidFromMention = /<@([0-9]+)>/;

var startTime = (new Date()).getTime();

var commands = {
    help: {
        permission: {
            uid: ["114855677482106888"],
            group: ["dev"],
            onlyMonitored: true
        },
        action: function(args, e) {
            var cmds = Object.keys(commands);
            var cmdlist = "* !" + cmds.join("\n* !");
            bot.sendMessage({
                to: e.channelID,
                message: "```\nBeep boop, I'm a bot!\n\nCommands:\n" + cmdlist + "```"
            })
        }

    },
    ping: {
        permission: {
            uid: ["114855677482106888"],
            group: ["dev"],
            onlyMonitored: true
        },
        action: function(args, e) {
            bot.sendMessage({
                to: e.channelID,
                message: "pong"
            })
        }
    },
    myid: {
        permission: {
            group: ["dev"],
            onlyMonitored: true
        },
        action: function(args, e) {
            bot.sendMessage({
                to: e.channelID,
                message: "<@" + e.userID + ">, your ID is " + e.userID
            })
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
            bot.sendMessage({
                to: e.channelID,
                message: "<@" + e.userID + "> " + uid
            })
        }
    },
    votestart: {
        permission: {
            group: ["votemakers", "dev"],
            onlyMonitored: true
        },
        action: function(args, e) {
            if(votes[e.channelID]) {
                bot.sendMessage({
                    to: e.channelID,
                    message: "<@" + e.userID + "> another poll already in progress! End it with  `!voteend`"
                });
                return;
            };
            if(args.length == 0) {
                bot.sendMessage({
                    to: e.channelID,
                    message: "<@" + e.userID + "> can't start an empty poll!"
                });
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
            bot.sendMessage({
                to: e.channelID,
                message: "<@" + e.userID + "> started a poll. Vote with `!vote <option number>`." + title + "\nOptions are:\n ```\n" + pollopts + "\n```"
            })
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

            bot.sendMessage({
                to: e.channelID,
                message: "<@" + e.userID + "> started a poll. Vote with `!vote <option number>`." + votes[e.channelID].title + "\nOptions are:\n ```\n" + votes[e.channelID].optionsString() + "\n```"
            })
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
                bot.sendMessage({
                    to: e.channelID,
                    message: "<@" + e.userID + "> no polls running!"
                });
                return;
            }
            var pollresult = votes[e.channelID].getVotesString();
            console.log("Results: " + pollresult);
            bot.sendMessage({
                to: e.channelID,
                message: "Poll ended! Results:\n**" + votes[e.channelID].title + "**\n ```\n" + pollresult + "\n```"
            });
            delete votes[e.channelID];
        }
    },
    group: {
        permission: {
            uid: ["114855677482106888"],
            group: ["dev"],
            onlyMonitored: true
        },
        action: function(args, e) {
            if(args[0] == "add") {
                var group = args[1];
                var user = uidFromMention.exec(args[2])[1];

                if(groups[group]) {
                    if(isUserInGroup(user, group)) {
                        bot.sendMessage({
                            to: e.channelID,
                            message: "<@" + e.userID + "> user " + args[2] + " (" + user + ")  already in group `" + group + "`"
                        });
                        return;
                    }
                } else {
                    bot.sendMessage({
                        to: e.channelID,
                        message: "<@" + e.userID + "> no group `" + group + "`"
                    });
                    return;
                }

                groups[group].push(user);

                bot.sendMessage({
                    to: e.channelID,
                    message: "<@" + e.userID + "> user " + args[2] + " (" + user + ")  added to `" + group + "`"
                });

                saveConfig();
            } else if(args[0] == "remove") {
                var group = args[1];
                var user = uidFromMention.exec(args[2])[1];

                if(groups[group]) {
                    if(!isUserInGroup(user, group)) {
                        bot.sendMessage({
                            to: e.channelID,
                            message: "<@" + e.userID + "> user " + args[2] + " (" + user + ")  is not in group `" + group + "`"
                        });
                        return;
                    }
                } else {
                    bot.sendMessage({
                        to: e.channelID,
                        message: "<@" + e.userID + "> no group `" + group + "`"
                    });
                    return;
                }

                groups[group].splice(groups[group].indexOf(user), 1);

                bot.sendMessage({
                    to: e.channelID,
                    message: "<@" + e.userID + "> user " + args[2] + " (" + user + ")  removed from `" + group + "`"
                });

                saveConfig();
            } else if(args[0] == "debug") {
                console.log(groups);
            } else if(args[0] == "list") {
                var str = "**Group list:**\n\n";
                var g = Object.keys(groups)
                for(var i = 0; i < g.length; i++) {
                    str += "`" + g[i] + "`: "
                    for(j = 0; j < groups[g[i]].length; j++) {
                        str += " <@" + groups[g[i]][j] + ">";
                    }
                    str += "\n";
                }

                bot.sendMessage({
                    to: e.channelID,
                    message: str
                });
            }
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
            var g = Object.keys(groups)
            for(var i = 0; i < g.length; i++) {
                if(isUserInGroup(subject, g[i])) {
                    str += " `"+g[i]+"` ";
                }
            }

            bot.sendMessage({
                to: e.channelID,
                message: str
            });
        }
    },
    kill: {
        permission: {
            uid: ["114855677482106888"]
        },
        action: function(args, e) {
            bot.sendMessage({
                to: e.channelID,
                message: "You monster >.<"
            });
            process.exit(0);
        }
    },
    restart: {
        permission: {
            uid: ["114855677482106888"]
        },
        action: function(args, e) {
            restart();
        }
    },
    message: {
        permission: {
            group: ["dev", "messages"],
            onlyMonitored: true
        },
        action: function(args, e) {
            if(args[0] == "add") {
                var msg = args.slice(2).join(" ");
                messages[args[1]] = msg;
                bot.sendMessage({
                    to: e.channelID,
                    message: "<@" + e.userID + "> added `!" + args[1] + "`: " + msg
                });
                saveConfig();
            } else if(args[0] == "remove") {
                if(!messages[args[1]]) {
                    bot.sendMessage({
                        to: e.channelID,
                        message: "<@" + e.userID + "> `!" + args[1] + "` doesn't exist"
                    });
                    return;
                }
                delete messages[args[1]];
                bot.sendMessage({
                    to: e.channelID,
                    message: "<@" + e.userID + "> removed `!" + args[1] + "`"
                });
                saveConfig();
            } else if(args[0] == "list") {
                var str = "**Message list:**\n\n";
                var g = Object.keys(messages)
                for(var i = 0; i < g.length; i++) {
                    str += "`!" + g[i] + "`\n";
                    str += messages[g[i]] + "\n";
                }

                bot.sendMessage({
                    to: e.channelID,
                    message: str
                });
            }
        }
    },
    say: {
        permission: {
            uid: ["114855677482106888"],
            group: ["dev"],
            onlyMonitored: true
        },
        action: function(args, e) {
            bot.sendMessage({
                to: e.channelID,
                message: args.join(" ")
            });
        }
    },
    join: {
        permission: {
            group: ["dev"],
            onlyMonitored: true
        },
        action: function(args, e) {
            bot.acceptInvite(args[0]);
        }
    },
    bat: {
        permission: {
            group: ["dev"],
            onlyMonitored: true
        },
        action: function(args, e) {
            bot.uploadFile({
                channel: e.channelID,
                file: fs.createReadStream("media/batbroken.gif")
            })
        }
    },
    track: {
        permission: {
            group: ["dev"],
            onlyMonitored: true
        },
        action: function(args, e) {
            if(args[0] == "start") {
                bot.sendMessage({
                    to: e.channelID,
                    message: "Message tracking started!"
                });
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
            bot.sendMessage({
                to: e.channelID,
                message: "I've been running for `" + t + " seconds`"
            });
        }
    },
    enable: {
        permission: {
            group: ["dev"],
            onlyMonitored: false
        },
        action: function(args, e) {
            if(channels.indexOf(e.channelID) != -1) {
                bot.sendMessage({
                    to: e.channelID,
                    message: "I'm already here >.<"
                });
                return;
            }
            channels.push(e.channelID);
            bot.sendMessage({
                to: e.channelID,
                message: "I will now monitor this channel :D"
            });
            saveConfig();
        }
    },
    disable: {
        permission: {
            group: ["dev"],
            onlyMonitored: true
        },
        action: function(args, e) {
            if(channels.indexOf(e.channelID) == -1) {
                return;
            }
            channels.splice(channels.indexOf(e.channelID), 1);
            saveConfig();
            bot.sendMessage({
                to: e.channelID,
                message: "I will no longer monitor this channel :("
            });
        }
    }

}


function saveConfig() {
    fs.writeFile("groups.json", JSON.stringify(groups), function(error) {
         if (error) {
           console.error("write error:  " + error.message);
         }
    });

    fs.writeFile("messages.json", JSON.stringify(messages), function(error) {
         if (error) {
           console.error("write error:  " + error.message);
         }
    });

    fs.writeFile("channels.json", JSON.stringify(channels), function(error) {
         if (error) {
           console.error("write error:  " + error.message);
         }
    });
}

function restart() {
    if(bot) {
        bot.disconnect();
    }

    bot = new DiscordClient({
        autorun: true,
        token: config.token
    });

    bot.on('ready', function() {
        console.log(bot.username + " - (" + bot.id + ")");
    });

    bot.on('message', processMessage);
}

function processMessage(user, userID, channelID, message, rawEvent) {
    console.log("Got message " + message + " on channel " + channelID + " from " + user + " (" + userID + ")");

    if(userID == bot.id) {
        return;
    }

    var parsed = parse(message);
    if(!parsed) {
        console.log("Not a command");
        return;
    }

    if(!canUserRun(parsed.command, userID, channelID)) {
        console.log("User cant run this command");
        return;
    }

    if(commands[parsed.command]) {
        commands[parsed.command].action(parsed.args, {
            "user": user,
            "userID": userID,
            "channelID": channelID,
            "event": rawEvent
        });
    } else {
        if(messages[parsed.command]) {
            bot.sendMessage({
                to: channelID,
                message: messages[parsed.command]
            });
            return;
        }
    }
}

function isUserInGroup(uid, group) {
    if(!groups || !groups[group]) {
        return false;
    }
    for(var i = 0; i < groups[group].length; i++) {
        if(groups[group][i] == uid) {
            return true;
        }
    }

    return false;
}

function canUserRun(command, uid, channelID) {
    if(!commands[command]) {
        if(messages[command] && channels.indexOf(channelID) != -1) {
            return true;
        }
        return false;
    }

    if(!commands[command].permission) {
        if(channels.indexOf(channelID) != -1){
            return true;
        } else {
            return false;
        }
    }

    if(commands[command].permission.onlyMonitored) {
        if(channels.indexOf(channelID) == -1){
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
            if(isUserInGroup(uid, commands[command].permission.group[i])) {
                return true;
            }
        }
    }

    return false;
}

function parse(string) {
    if(string.charAt(0) != '!') {
        return false;
    }

    var pieces = string.split(" ");
    pieces[0] = pieces[0].slice(1, pieces[0].length);

    return {
        command: pieces[0],
        args: pieces.slice(1, pieces.length)
    };
}

restart();
