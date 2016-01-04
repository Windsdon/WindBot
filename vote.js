function Vote(options, title) {
    this.options = options;
    this.voted = [];
    this.votes = new Array(this.options.length);
    this.title = title;
    for(var i = 0; i < this.options.length; i++) {
        this.votes[i] = 0;
    }

    this.vote = function(userID, option) {
        if(this.voted.indexOf(userID) != -1) {
            return false;
        }
        var o = parseInt(option.toString()) - 1;
        if(o != o || o < 0 || o > this.votes.length - 1) {
            return false;
        }

        console.log("Vote for " + o);

        this.votes[o]++;
        this.voted.push(userID);
        return true;
    }

    this.optionsString = function() {
        var str = "";
        for(var i = 0; i < this.options.length; i++) {
            if(i) {
                str += "\n";
            }
            str += (i + 1) + ": " + this.options[i];
        }

        return str;
    }

    this.getVotesString = function() {
        var got = [];
        var totalVotes = 0;
        var maxLength = 0;
        var forString = []
        for(var i = 0; i < this.votes.length; i++) {
            totalVotes += this.votes[i];
            if(this.options[i].length > maxLength) {
                maxLength = this.options[i].length;
            }
        }

        while(got.length != this.votes.length) {
            var min = 1000000;
            var minI = -1;
            for(var i = 0; i < this.votes.length; i++) {
                console.log("votes["+ i +"]" + this.votes[i]);
                if(got.indexOf(i) == -1 && this.votes[i] <= min) {
                    console.log("Make " + i + " min with " + this.votes[i]);
                    min = this.votes[i];
                    minI = i;
                }
            }
            if(!totalVotes) {
                var num = 0;
            } else {
                var num = this.votes[minI]/totalVotes;
            }
            console.log(i);
            forString.push(this.makeSize(this.options[minI], maxLength) + "  " + this.makeProgressBar(num, 30) + "  " + this.votes[minI]);
            got.push(minI);
        }

        forString.reverse();

        return forString.join("\n");
    }

    this.makeSize = function(str, len) {
        return  str + (new Array(len - str.length + 1)).join(" ");
    }

    this.makeProgressBar = function(num, max) {
        var a = num * max;
        var str = "";
        for(i = 0; i < max; i++) {
            if(i < a) {
                str += "|";
            } else {
                str += "-";
            }
        }

        return str;
    }
}

module.exports = Vote;
