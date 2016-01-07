var fs = require("fs");

function database() {
    this.groups = require("./groups.json");
    this.messages = require("./messages.json");
    this.channels = require("./channels.json");
    this.passes = require("./pass.json");
    this.images = require("./images.json");

    this.saveConfig = function() {
        fs.writeFile("groups.json", JSON.stringify(this.groups), function(error) {
             if (error) {
               console.error("write error:  " + error.message);
             }
        });

        fs.writeFile("messages.json", JSON.stringify(this.messages), function(error) {
             if (error) {
               console.error("write error:  " + error.message);
             }
        });

        fs.writeFile("channels.json", JSON.stringify(this.channels), function(error) {
             if (error) {
               console.error("write error:  " + error.message);
             }
        });

        fs.writeFile("images.json", JSON.stringify(this.images), function(error) {
             if (error) {
               console.error("write error:  " + error.message);
             }
        });
    },

    this.isUserInGroup = function (uid, group) {
        if(!this.groups || !this.groups[group]) {
            return false;
        }
        for(var i = 0; i < this.groups[group].length; i++) {
            if(this.groups[group][i] == uid) {
                return true;
            }
        }

        return false;
    }
}

module.exports = database;
