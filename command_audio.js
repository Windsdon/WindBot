var utils = require("./utils.js");
var SC = require("node-soundcloud");
var config = require("./config.json");
var temp = require("temp").track();
var https = require("https");
var fs = require("fs");

SC.init({
    id: config.soundcloud.id,
    secret: config.soundcloud.secret,
    uri: ''
});

module.exports = {
    permission: {
        group: ["audio", "devs"]
    },
    currentChannel: false,
    action: function(args, e) {
        if(args[0] == "join") {
            var channel = args[1];
            var self = this;
            e.bot.joinVoiceChannel(channel, function() {
                self.currentChannel = channel;
                console.log("Now on channel " + channel);
                e.bot.sendMessage({
                    to: e.channelID,
                    message: "<@" + e.userID + "> Now on channel " + channel
                });
            });
        } else if(args[0] == "play") {
            if(args.length < 2) {
                e.bot.sendMessage({
                    to: e.channelID,
                    message: "<@" + e.userID + "> usage: `!audio play <id>`"
                });
                return;
            }

            if(!this.currentChannel) {
                e.bot.sendMessage({
                    to: e.channelID,
                    message: "<@" + e.userID + "> I'm not in any voice channels!"
                });
                return;
            }

            if(!e.db.sounds[args[1]]) {
                e.bot.sendMessage({
                    to: e.channelID,
                    message: "<@" + e.userID + "> No sound named `" + args[1] + "`"
                });
                return;
            }

            var filename = e.db.sounds[args[1]].file;
            e.bot.sendMessage({
                to: e.channelID,
                message: "<@" + e.userID + "> Now playing: " + this.getInfoMessage(e, args[1])
            });
            e.bot.getAudioContext(this.currentChannel, function(stream) {
                console.log("**** Playing " + filename);
                stream.playAudioFile(filename);
            });
        } else if(args[0] == "add") {
            if(args.length < 3) {
                e.bot.sendMessage({
                    to: e.channelID,
                    message: "<@" + e.userID + "> usage: `!audio add <id> <filename>`"
                });
                return;
            }

            this.add(e, args[2]);
        } else if(args[0] == "stop") {

            e.bot.sendMessage({
                to: e.channelID,
                message: "<@" + e.userID + "> Stopping all audio playback"
            });
            e.bot.getAudioContext(this.currentChannel, function(stream) {
                stream.stopAudioFile();
            });
        } else if(args[0] == "leave") {
            e.bot.sendMessage({
                to: e.channelID,
                message: "<@" + e.userID + "> Leaving channel " + this.currentChannel
            });
            e.bot.leaveVoiceChannel(this.currentChannel);
        } else if(args[0] == "sc") {
            var context = e;
            var self = this;
            self.getTrackID("https://soundcloud.com/" + args[1], function(trackID) {
                context.bot.sendMessage({
                    to: context.channelID,
                    message: "<@" + e.userID + "> your track has id `" + trackID + "`"
                });
                if(context.db.sounds[trackID]) {
                    context.bot.sendMessage({
                        to: context.channelID,
                        message: "<@" + e.userID + "> I already have that!"
                    });
                    return;
                }
                var path = './media/audio/' + trackID + '.mp3';
                self.getTrack(trackID, function(track) {
                    var trackInfo = track;
                    console.log("\n\nTrack info:\n",trackInfo);
                    self.getStreamURL(trackID, function(streamURL) {
                        self.saveToFile(streamURL, path, function(response) {
                            context.bot.sendMessage({
                                to: context.channelID,
                                message: "<@" + e.userID + "> downloading track, size: `" + (parseInt(response.headers['content-length'])/1048576).toFixed(2) + "MB`"
                            });
                        }, function(response) {
                            console.log("--- Finished!!!");
                            context.bot.sendMessage({
                                to: context.channelID,
                                message: "<@" + e.userID + "> Finished downloading track `" +  trackID + "`"
                            });
                            self.add(context, trackID, trackID + ".mp3", {
                                name: trackInfo.title,
                                author: trackInfo.user.username,
                                provider: trackInfo.permalink_url
                            });
                        });
                    });
                });
            });
        } else if (args[0] == "remove") {
            if(!e.db.sounds[args[1]]) {
                e.bot.sendMessage({
                    to: e.channelID,
                    message: "<@" + e.userID + "> I don't have that!"
                });
                return;
            }
            delete e.db.sounds[args[1]];
            e.db.saveConfig();
            e.bot.sendMessage({
                to: e.channelID,
                message: "<@" + e.userID + "> removed " + args[1]
            });
        } else {
            e.bot.sendMessage({
                to: e.channelID,
                message: "<@" + e.userID + "> Usage: !sound <join|leave|add|remove|play|stop|sc>"
            });
        }
    },
    getInfoMessage: function(e, id) {
        var info = e.db.sounds[id];
        if(!info.extra) {
            return info.file;
        }
        var str = "";
        if(info.extra.name) {
            str += "**" + info.extra.name + "**";
            if(info.extra.author) {
                str += " by *" + info.extra.author + "*";
            }
        } else if(info.extra.author){
            str += "A track by **" + info.extra.author + "**";
        } else {
            str += "A track named `" + info.file + "`";
        }

        if(info.extra.provider) {
            str += "\n" + info.extra.provider;
        }

        return str;
    },
    playFile: function(e, channelID, file) {
        e.bot.getAudioContext(channelID, function(stream) {
            stream.playAudioFile(file);
        });
    },
    getTrackID: function(url, callback) {
        SC.get('/resolve', {
            url: url
        }, function(err, val) {
            console.log(val);
            var test = /tracks\/([0-9]+)/;
            if(val.errors) {
                callback(false);
                return;
            }
            callback(val.location.match(test)[1]);
        })
    },
    getTrack: function(trackID, callback) {
        SC.get('/tracks/' + trackID, function(err, track) {
            if (err) {
                callback(false);
            } else {
                callback(track);
            }
        });
    },
    getStreamURL: function(trackID, callback) {
        SC.get('/tracks/' + trackID + "/stream", function(err, track) {
            if (err) {
                callback(false);
            } else {
                callback(track.location);
            }
        });
    },
    saveToFile: function(streamURL, path, callbackBegin, callbackEnd) {
        var file = fs.createWriteStream(path);
        var request = https.get(streamURL, function(response) {
            callbackBegin(response);
            response.pipe(file);
        });
        request.on("close", function(response){
            callbackEnd(response);
        });
    },
    add: function(e, id, file, extra) {
        var filename = "./media/audio/" + file;
        e.db.sounds[id] = {
            file: filename,
            extra: extra
        };

        e.bot.sendMessage({
            to: e.channelID,
            message: "<@" + e.userID + "> added audio `" + id + "`"
        });

        e.db.saveConfig();
    }

}
