var utils = require("./utils.js");
var SC = require("node-soundcloud");
var config = require("./config.json");
var temp = require("temp").track();
var https = require("https");
var fs = require("fs");
var ytdl = require('ytdl-core');
var utils = require("./utils.js");

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
    lastSearch: [],
    action: function(args, e) {
        console.log(args);
        if(this.announceChannel != e.channelID && args[0] != "announce") {
            e.bot.sendMessage({
                to: e.channelID,
                message: "<@" + e.userID + "> I can't be used here! Please change me to this channel before!"
            });
            return;
        }
        if(args[0] == "join") {
            var channel = args[1];
            var self = this;
            if(channel == "me") {
                var server = utils.findServer(e);
                if(!server) {
                    e.bot.sendMessage({
                        to: e.channelID,
                        message: "<@" + e.userID + "> I can't seem to find your server!"
                    });
                    return;
                }
                var user = e.bot.servers[server].members[e.userID];
                if(!user || !user.voice_channel_id) {
                    e.bot.sendMessage({
                        to: e.channelID,
                        message: "<@" + e.userID + "> You are not in any voice channels!"
                    });
                    return;
                }

                channel = user.voice_channel_id;
            }
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
        } else if (args[0] == "yt") {
            if(!args[1] || !args[1].match(/^[A-Za-z0-9_\-]+$/)) {
                e.bot.sendMessage({
                    to: e.channelID,
                    message: "<@" + e.userID + "> Usage: `!audio yt <id> [play|queue]`"
                });
                return;
            }
            var context = e;
            var self = this;
            var shouldQueue = false;
            var shouldPlay = false;
            var videoID = args[1];
            if(args[2] == "play") {
                shouldPlay = true;
            } else if(args[2] == "queue") {
                shouldQueue = true;
            }
            if(context.db.sounds[videoID]) {
                context.bot.sendMessage({
                    to: context.channelID,
                    message: "<@" + e.userID + "> I already have that!"
                });
                if(shouldPlay) {
                    console.log("starting play sequence");
                    self.action(["play", videoID], context);
                } else if(shouldQueue) {
                    self.action(["queue", videoID], context)
                }
                return;
            }
            ytdl.getInfo("http://youtube.com/watch?v=" + videoID, {
                filter: "audio"
            }, function(err, info) {
                if(!info) {
                    e.bot.sendMessage({
                        to: e.channelID,
                        message: "<@" + e.userID + "> That video isn't valid!"
                    });
                    return;
                }
                var path = './media/audio/' + videoID + '.mp4';
                var saveFormat = false;
                var stream = ytdl.downloadFromInfo(info, {
                    filter: "audioonly"
                }).on("info", function(info, format) {
                    console.log(format);
                    path = './media/audio/' + videoID + '.' + format.container;
                    saveFormat = format;
                }).on("response", function(response) {
                    if(!path) {
                        e.bot.sendMessage({
                            to: e.channelID,
                            message: "<@" + e.userID + "> couldn't get info in time - using mp4"
                        });
                    }
                    e.bot.sendMessage({
                        to: e.channelID,
                        message: "<@" + e.userID + "> Downloading `" + info.title + "` (" + (parseInt(response.headers['content-length'])/1048576).toFixed(2) +  " MB)"
                    });
                    response.on("end", function() {
                        console.log("--- FINISHED!");
                        self.add(context, videoID, videoID + ".mp4", {
                            name: info.title
                        });
                        if(shouldPlay) {
                            console.log("starting play sequence");
                            self.action(["play", videoID], context);
                        } else if(shouldQueue) {
                            self.action(["queue", videoID], context)
                        }
                    })
                }).pipe(fs.createWriteStream(path));
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
            if(args[1] == "~") {
                this.queue = this.queue.concat(this.lastSearch);
                e.bot.sendMessage({
                    to: e.channelID,
                    message: "<@" + e.userID + "> queued: `" + JSON.stringify(this.lastSearch) + "`"
                });
                return;
            }

            if(!e.db.sounds[args[1]]) {
                e.bot.sendMessage({
                    to: e.channelID,
                    message: "<@" + e.userID + "> I don't have that!"
                });
                return;
            }

            this.queue.push(args[1]);
            e.bot.sendMessage({
                to: e.channelID,
                message: "<@" + e.userID + "> queued: `" + args[1] + "`"
            });
            if(!this.playing) {
                this.playNext(e, this.announceChannel);
            }
        } else if(args[0] == "announce") {
            this.announceChannel = e.channelID;
            e.bot.sendMessage({
                to: e.channelID,
                message: "<@" + e.userID + "> Now active here!"
            });
        } else if(args[0] == "next") {
            this.playNext(e, this.announceChannel);
        } else if(args[0] == "search") {
            if(!args[1] || args[1].length < 3) {
                e.bot.sendMessage({
                    to: e.channelID,
                    message: "<@" + e.userID + "> you need at least 3 chars"
                });
                return;
            }

            var search = args[1];
            var list = this.find(e.db.sounds, search);
            this.lastSearch = list;
            if(!list) {
                e.bot.sendMessage({
                    to: e.channelID,
                    message: "<@" + e.userID + "> I found nothing for `" + search + "`"
                });
                return;
            }
            var str = "";
            for(var i = 0; i < list.length; i++) {
                var info = this.getInfoMessage(e, list[i], {
                    provider: true
                });
                if(i) {
                    str += "\n";
                }
                str += "* [" + list[i] + "] " + info;
            }
            e.bot.sendMessage({
                to: e.channelID,
                message: "<@" + e.userID + "> I found these things:\n" + str + "\n You can run `audio queue ~` to add them to the list"
            });
        } else {
            e.bot.sendMessage({
                to: e.channelID,
                message: "<@" + e.userID + "> Usage: !audio <join|leave|add|remove|play|stop|sc|yt|search>"
            });
        }
    },
    find: function(list, what) {
        what = what.toLowerCase();
        var keys = Object.keys(list);
        var b = [];
        for(var i = 0; i < keys.length; i++) {
            var o = list[keys[i]];
            var found = false;
            if(keys[i].toLowerCase().indexOf(what) != -1 ||
                o.file.toLowerCase().indexOf(what) != -1) {
                found = true;
            }
            if(o.extra) {
                if(o.extra.name && o.extra.name.toLowerCase().indexOf(what) != -1) {
                    found = true;
                }
                if(o.extra.author && o.extra.author.toLowerCase().indexOf(what) != -1) {
                    found = true;
                }
                if(o.extra.provider && o.extra.provider.toLowerCase().indexOf(what) != -1) {
                    found = true;
                }
            }

            if(found) {
                b.push(keys[i]);
            }
        }

        return b;
    },
    getInfoMessage: function(e, id, remove) {
        var info = e.db.sounds[id];
        if(!info.extra) {
            return "A track named `" + info.file + "`";
        }
        var str = "";
        if(info.extra.name && (!remove || (remove && !remove.name))) {
            str += "**" + info.extra.name + "**";
            if(info.extra.author && (!remove || (remove && !remove.author))) {
                str += " by *" + info.extra.author + "*";
            }
        } else if(info.extra.author && (!remove || (remove && !remove.author))){
            str += "A track by **" + info.extra.author + "**";
        } else {
            str += "A track named `" + info.file + "`";
        }

        if(info.extra.provider && (!remove || (remove && !remove.provider))) {
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
                self.playing = false;
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
