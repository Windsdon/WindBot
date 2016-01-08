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
    announceChannel: false,
    playing: false,
    queue: [],
    action: function(args, e) {
        console.log(args);
        if(false && this.announceChannel != e.channelID && args[0] != "announce") {
            e.bot.sendMessage({
                to: e.channelID,
                message: "<@" + e.userID + "> I can't be used here! Please change me to this channel before!"
            });
            return;
        }
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

            this.play(e, args[1], this.announceChannel);
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
            var shouldQueue = false;
            var shouldPlay = false;
            if(args[2] == "play") {
                shouldPlay = true;
                console.log("Playing after!");
            } else if(args[2] == "queue") {
                shouldQueue = true;
            }
            self.getTrackID("https://soundcloud.com/" + args[1], function(trackID) {
                console.log("TrackID: ", trackID);
                if(!trackID) {
                    context.bot.sendMessage({
                        to: context.channelID,
                        message: "<@" + e.userID + "> that track is invalid: " + trackID
                    });
                    return;
                }
                context.bot.sendMessage({
                    to: context.channelID,
                    message: "<@" + e.userID + "> your track has id `" + trackID + "`"
                });
                if(context.db.sounds[trackID]) {
                    context.bot.sendMessage({
                        to: context.channelID,
                        message: "<@" + e.userID + "> I already have that!"
                    });
                    if(shouldPlay) {
                        console.log("starting play sequence");
                        self.action(["play", trackID], context);
                    } else if(shouldQueue) {
                        self.action(["queue", trackID], context)
                    }
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
                            if(shouldPlay) {
                                self.action(["play", trackID], context);
                            } else if(shouldQueue) {
                                self.action(["queue", trackID], context)
                            }
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
        } else if (args[0] == "queue") {
            this.queue.push(args[1]);
            e.bot.sendMessage({
                to: e.channelID,
                message: "<@" + e.userID + "> queued: `" + args[1] + "`"
            });
        } else if(args[0] == "announce") {
            this.announceChannel = e.channelID;
            e.bot.sendMessage({
                to: e.channelID,
                message: "<@" + e.userID + "> Now active here!"
            });
        } else {
            e.bot.sendMessage({
                to: e.channelID,
                message: "<@" + e.userID + "> Usage: !audio <join|leave|add|remove|play|stop|sc>"
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
            console.log(err, val);
            var test = /tracks\/([0-9]+)/;
            if(!val || val.errors) {
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
    },
    play: function(e, id, announceChannel) {
        var filename = e.db.sounds[id].file;
        console.log("Play requested for " + id);
        e.bot.sendMessage({
            to: announceChannel,
            message: "Now playing: " + this.getInfoMessage(e, id)
        });
        var self = this;
        e.bot.getAudioContext(this.currentChannel, function(stream) {
            if(self.playing) {
                stream.stopAudioFile();
            }
            self.playing = id;
            console.log("**** Playing " + filename);
            stream.playAudioFile(filename);
            stream.once('fileEnd', function() {
                self.playNext(e, announceChannel);
            });
        });
    },
    playNext: function(e, announceChannel) {
        if(this.queue.length == 0) {
            e.bot.sendMessage({
                to: announceChannel,
                message: "**Reached the end of the queue!**"
            });
            return;
        }
        this.action(["play", this.queue.splice(0, 1)[0]], e);
    }

}
