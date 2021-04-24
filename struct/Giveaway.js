module.exports = class Giveaway {
    constructor(options) {

        this.time = options.time
        this.prize = options.prize
        this.winners = options.winners
        this.host = options.hostID
        this.startDate = Date.now()
        this.endDate = Date.now() + this.time
        this.winners = 1

        this.channel = options.channelID
        this.message = options.messageID
        this.guild = options.guildID
        this.ended = false

        this.reqGuild = options.reqGuild
        this.reqMessage = options.reqMessage
        this.reqRole = options.reqRole
    }

    get getURL() {
        return `https://www.discord.com/channels/${this.guild}/${this.channel}/${this.message}`
    }
    
    get hostedMention() {
        return `<@${this.host}>`
    }
}
