const Giveaway = require('./Giveaway'),
    {
        MessageEmbed,
        User,
        Client,
        TextChannel,
        Message,
        MessageReaction,
        Role,
        Guild,
        ColorResolvable
    } = require('discord.js'),
    moment = require('moment'),
    {
        stripIndent
    } = require('common-tags'),
    Enmap = require('enmap'),
    _ = require('lodash'),
    storedGiveaways = new Enmap({
        name: "giveaways",
        autoFetch: true,
        fetchAll: true
    }),
    rerollDB = new Enmap({
        name: "reroll",
        autoFetch: true,
        fetchAll: true
    })
defaultOptions = {
        reaction: "🎉",
        winMsg: `Congratulations {winner}! You won {prize}!\n{url}`,
        notEnoughMsg: `There weren't enough participants for me to decide a winner!\n{url}`,
        startEmbed: {},
        endEmbed: {},
        embed: {
            startMsg: "🎉 **Giveaway** 🎉",
            startEmbedColor: "BLUE",

            endMsg: "🎉 **Giveaway Ended** 🎉",
            endEmbedColor: "#000000"
        }
    },
    messages = new Enmap({
        name: "messages",
        fetchAll: true,
        autoFetch: true
    })

class GiveawayManager {

    /** 
     * @typedef {Object} ManagerOptions
     * @property {MessageReaction} reaction
     * @property {string} winMsg
     * @property {string} notEnoughMsg
     * @property {MessageEmbed} startEmbed
     * @property {MessageEmbed} endEmbed
     * @property {Object} embed
     * @property {string} embed.startMsg
     * @property {ColorResolvable} embed.startEmbedColor Won't be used if you provide startEmbed
     * @property {string} embed.endMsg 
     * @property {ColorResolvable} embed.endEmbedColor Won't be used if you provide endEmbed
     */

    /**
     * 
     * @param {Client} client 
     * @param {ManagerOptions} options 
     */

    constructor(client, options) {

        this.options = {
            ...defaultOptions,
            ...options
        }

        this.giveaways = storedGiveaways
        this.reDb = rerollDB
        this.client = client
        this.checkGiveaways()
    }

    /**
     *  @typedef {Object} GiveawayOptions
     * @property {number} time The time of the giveaway
     * @property {number} winners The amount of winners for the giveaway
     * @property {string} prize The prize of the giveaway
     * @property {Role} reqRole The required role of the giveaway
     * @property {Guild} reqGuild The guild required for the giveaway
     * @property {number} reqMessage The amount of messages required for the giveaway
     */

    /**
     * 
     * @param {TextChannel} channel A discord guild channel instance
     * @param {Message} msg A message object received from Client.Message
     * @param {GiveawayOptions} options Options for the giveaway
     */

    async create(channel, msg, options) {
        storedGiveaways.ensure('giveaways', [])
        if (typeof options.prize !== "string") throw Error(`prize must be string. Received type "${typeof options.prize}".`)
        if (isNaN(options.time)) throw Error(`time must be number. Received type "${typeof options.time}".`)
        if (isNaN(options.winners)) throw Error(`winners must be number. Received type "${typeof options.winner}".`)
        let user = msg.author
        let guild = this.client.guilds.cache.get(channel.guild.id)
        let message = await channel.messages.fetch(options.messageID)

        if (!user) throw Error(`host must be valid user id. Received type "${user}".`)
        if (!guild) throw Error(`guildID must be valid guild id. Received type "${guild}" when fetching.`)
        if (!channel) throw Error(`channelID must be valid channel id. Received type "${channel}" when fetching.`)
        if (!message) throw Error(`messageID must be valid message id. Received type "${message}" when fetching.`)

        const giveaway = new Giveaway({
            time: options.time,
            prize: options.prize,
            winners: options.winners,
            reqRole: options.reqRole.id,
            reqGuild: options.reqGuild.id,
            reqMessage: options.reqMessage,
            hostID: msg.author.id,
            guildID: channel.guild.id,
            channelID: channel.id
        })

        let embed = await this.generateStartEmbed(this.options.startEmbed, giveaway)
        let reactMsg = await channel.send(this.options.embed.startMsg, embed)
        await reactMsg.react(this.options.reaction)
        giveaway.message = reactMsg.id
        storedGiveaways.set(`giveaways_${channel.guild.id}_${reactMsg.id}`, {
            ...giveaway,
            url: giveaway.getURL,
            hostMention: giveaway.hostedMention
        })

        rerollDB.set(`giveaways_${channel.guild.id}_${reactMsg.id}`, {
            ...giveaway,
            url: giveaway.getURL,
            hostMention: giveaway.hostedMention
        })
    }

    /**
     * 
     * @param {MessageReaction} reaction 
     * @param {User} user 
     * @param {Giveaway} giveaway 
     */

    async manageReaction(reaction, user) {
        let {
            message
        } = reaction
        let giveaway = this.giveaways.get(`giveaways_${message.guild.id}_${message.id}`)
        if (!giveaway) return;
        let passed = true
        let reason = []
        if (giveaway.reqGuild) {
            let guild = this.client.guilds.cache.get(giveaway.reqGuild)
            if (!guild) return;

            try {
                await guild.members.fetch(user.id)
            } catch (e) {
                passed = false
                reason.push("guild")
            }
        }
        if (giveaway.reqRole) {
            let guild = message.guild
            let member = await guild.members.fetch(user.id)
            if (!member.roles.cache.has(giveaway.reqRole)) {
                passed = false
                reason.push("role")
            }
        }
        if (giveaway.reqMessage) {
            let userMessages = messages.get(user.id)

            if (userMessages < giveaway.reqMessage) passed = false
            reason.push("messages")
        }

        if (!passed) {
            await reaction.users.remove(user)
            user.send(`ENTRY DENIED!\nMissing requirement: ${reason.join(", ")}`)
        } else {
            user.send("ENTRY ACCEPTED")
        }
    }

    /**
     * 
     * @param {Message} message 
     */

    add(message) {
        messages.ensure(message.author.id, 0)
        messages.inc(message.author.id)
    }

    /**
     * 
     * @param {Message} message 
     * @param {Giveaway} giveaway 
     */

    async reroll(message, giveaway) {

        let reGiveaway = this.reDb.get(`giveaways_${giveaway.guild}_${giveaway.message}`)
        if (!reGiveaway) throw Error("Invalid giveaway")

        let reactMsg = message
        await reactMsg.reactions.cache.get(this.options.reaction).users.fetch()
        let messageReactions = reactMsg.reactions.cache.get(this.options.reaction)
        let winners = messageReactions.users.cache
            .filter(c => !c.bot)
            .random(reGiveaway.winners)

        let embed = await this.generateEndEmbed(this.options.endEmbed, reGiveaway, winners)

        let embedWinners = this.generateMentions(winners)
        let endMsg = embedWinners ? this.options.winMsg
            .replace(/\{winner\}/g, this.generateMentions(winners))
            .replace(/\{prize}/g, `**${reGiveaway.prize}**`)
            .replace(/\{url\}/g, reGiveaway.url) : this.options.notEnoughMsg
            .replace(/\{winner\}/g, this.generateMentions(winners))
            .replace(/\{prize}/g, `**${reGiveaway.prize}**`)
            .replace(/\{url\}/g, reGiveaway.url)

        let guild = this.client.guilds.cache.get(reGiveaway.guild)
        let channel = guild.channels.cache.get(reGiveaway.channel)

        await message.edit(this.options.embed.endMsg, embed)
        await channel.send(endMsg)
    }

    checkGiveaways() {
        setInterval(() => {
            let giveaways = this.giveaways.filter((v, key) => key.startsWith(`giveaways`))
            if (!giveaways) return;

            giveaways.forEach(c => {
                if (c.endDate < Date.now()) {
                    giveaways.set(`giveaways_${c.guild}_${c.message}`, true, "ended")
                }
            })
            this.endAllGiveaways(giveaways.filter(c => c.ended))
        }, 2 * 1000)
    }

    /**
     * @param {Giveaway[]} giveaways 
     */

    endAllGiveaways(giveaways) {
        giveaways.forEach(async c => {
            if (c.ended) {
                let guild = this.client.guilds.cache.get(c.guild)
                let channel = guild.channels.cache.get(c.channel)
                let message = await channel.messages.fetch(c.message)

                await this.end(message, c)
            }
        })
    }

    /**
     * 
     * @param {Message} message 
     * @param {Giveaway} giveaway
     */

    async end(message, giveaway) {
        if (!storedGiveaways.get(`giveaways_${giveaway.guild}_${giveaway.message}`)) throw Error("Giveaway already ended")

        let reactMsg = message
        await reactMsg.reactions.cache.get(this.options.reaction).users.fetch()
        let messageReactions = reactMsg.reactions.cache.get(this.options.reaction)
        let winners = messageReactions.users.cache
            .filter(c => !c.bot)
            .random(giveaway.winners)

        let embed = await this.generateEndEmbed(this.options.endEmbed, giveaway, winners)
        reactMsg.edit(this.options.embed.endMsg, embed)

        let embedWinners = this.generateMentions(winners)
        let endMsg = embedWinners ? this.options.winMsg
            .replace(/\{winner\}/g, this.generateMentions(winners))
            .replace(/\{prize}/g, `**${giveaway.prize}**`)
            .replace(/\{url\}/g, giveaway.url) : this.options.notEnoughMsg
            .replace(/\{winner\}/g, this.generateMentions(winners))
            .replace(/\{prize}/g, `**${giveaway.prize}**`)
            .replace(/\{url\}/g, giveaway.url)

        let guild = this.client.guilds.cache.get(giveaway.guild)
        let channel = guild.channels.cache.get(giveaway.channel)
        channel.send(endMsg)

        this.giveaways.delete(`giveaways_${giveaway.guild}_${giveaway.message}`)
    }

    /**
     * 
     * @param {Giveaway} giveaway 
     */

    async updateGiveaway(giveaway) {
        let guild = this.client.guilds.cache.get(giveaway.guild)
        let channels = guild.channels.cache.get(giveaway.channel)
        let giveawayMessage = await channels.messages.fetch(giveaway.message)

        let embed = giveawayMessage.embeds[0]
        let content = Object.keys(embed).map(c => c.join(" "))

    }

    /** 
     * @param {MessageEmbed} embedData
     * @param {Giveaway} giveaway
     * @private
     */

    async generateStartEmbed(embedData, giveaway) {

        let endDate = moment(giveaway.endDate).format('lll')
        let startDate = moment(giveaway.startDate).format('lll')
        let winners = giveaway.winners < 1 ? `${giveaway.winners} winners` : `${giveaway.winners} winner`
        let reqMessage = ""
        if (giveaway.reqGuild) {
            let guild = this.client.guilds.cache.get(giveaway.reqGuild)
            let channel = guild.channels.cache.filter(c => c.permissionsFor(guild.me).has("CREATE_INSTANT_INVITE")).filter(c => c.type !== "category")
            channel = channel.first()
            if (channel) {
                let invite = await channel.createInvite({
                    maxAge: 0,
                    maxUses: 0
                })
                reqMessage += `Must join [${guild.name}](${invite.url})\n`
            }
        }

        if (giveaway.reqRole) {
            let guild = this.client.guilds.cache.get(giveaway.guild)
            let role = guild.roles.cache.get(giveaway.reqRole)
            if (role) {
                reqMessage += `Must have role **${role.name}**\n`
            }
        }

        if (giveaway.reqMessage) {
            reqMessage += `Must have **${giveaway.reqMessage}** messages\n`
        }

        if (reqMessage.length === 0) {
            reqMessage = "No requirements"
        }

        if (embedData instanceof MessageEmbed) {
            let replacedEntries = Object.entries(embedData).map(([key, value]) => {
                if (value === null) return [key, value]
                if (!value.length && Array.isArray(value)) return [key, value]
                if (key === "type") return [key, value]

                if (Array.isArray(value)) {

                    value = value.value
                        .replace(/\{host\}/g, giveaway.hostedMention)
                        .replace(/\{endsAt\}/g, endDate)
                        .replace(/\{startsAt\}/g, startDate)
                        .replace(/\{winners\}/g, winners)
                        .replace(/\{prize\}/g, giveaway.prize)
                        .replace(/\{req}/g, `${reqMessage}`)
                    return [key, value]
                }
                value = value
                    .replace(/\{host\}/g, giveaway.hostedMention)
                    .replace(/\{endsAt\}/g, endDate)
                    .replace(/\{startsAt\}/g, startDate)
                    .replace(/\{winners\}/g, winners)
                    .replace(/\{prize\}/g, giveaway.prize)
                    .replace(/\{req}/g, `${reqMessage}`)

                return [key, value]
            })

            let replacedObject = Object.fromEntries(replacedEntries)
            return new MessageEmbed(replacedObject)
        } else {
            return new MessageEmbed({
                title: giveaway.prize,
                description: stripIndent(`React with ${this.options.reaction} to enter!
                
                Hosted by: ${giveaway.hostedMention}
                Ends at: ${endDate}
                Winners: ${winners}
                
                ${reqMessage}`),
                color: this.options.embed.startEmbedColor,
                footer: {
                    text: `Created by: Raccoon#7867`
                }
            })
        }
    }

    /** 
     * @param {MessageEmbed} embedData
     * @param {Giveaway} giveaway
     * @param {User[]} winners
     * @private
     */
    async generateEndEmbed(embedData, giveaway, winners) {
        let winnerMentions = this.generateMentions(winners)
        let endDate = moment(giveaway.endDate).format('lll')
        let startDate = moment(giveaway.startDate).format('lll')

        let reqMessage = ""
        if (giveaway.reqGuild) {
            let guild = this.client.guilds.cache.get(giveaway.reqGuild)
            let channel = guild.channels.cache.filter(c => c.permissionsFor(guild.me).has("CREATE_INSTANT_INVITE")).filter(c => c.type !== "category")
            channel = channel.first()
            if (channel) {
                let invite = await channel.createInvite({
                    maxAge: 0,
                    maxUses: 0
                })
                reqMessage += `Must join [${guild.name}](${invite.url})\n`
            }
        }

        if (giveaway.reqRole) {
            let guild = this.client.guilds.cache.get(giveaway.guild)
            let role = guild.roles.cache.get(giveaway.reqRole)
            if (role) {
                reqMessage += `Must have role **${role.name}**\n`
            }
        }

        if (giveaway.reqMessage) {
            reqMessage += `Must have **${giveaway.reqMessage}** messages\n`
        }

        if (reqMessage.length === 0) {
            reqMessage = "No requirements"
        }

        if (embedData instanceof MessageEmbed) {
            let replacedEntries = Object.entries(embedData).map(([key, value]) => {
                if (value === null) return [key, value]
                if (!value.length && Array.isArray(value)) return [key, value]
                if (key === "type") return [key, value]

                if (Array.isArray(value)) {
                    value = value.value
                        .replace(/\{host\}/g, giveaway.hostMention)
                        .replace(/\{endsAt\}/g, endDate)
                        .replace(/\{startsAt\}/g, startDate)
                        .replace(/\{winners\}/g, winnerMentions)
                        .replace(/\{prize\}/g, giveaway.prize)
                        .replace(/\{req}/g, `${reqMessage}`)

                    return [key, value]
                }
                value = value
                    .replace(/\{host\}/g, giveaway.hostMention)
                    .replace(/\{endsAt\}/g, endDate)
                    .replace(/\{startsAt\}/g, startDate)
                    .replace(/\{winners\}/g, winnerMentions)
                    .replace(/\{prize\}/g, giveaway.prize)
                    .replace(/\{req}/g, `${reqMessage}`)

                return [key, value]
            })
            let replacedObject = Object.fromEntries(replacedEntries)
            return new MessageEmbed(replacedObject)
        } else {
            return new MessageEmbed({
                title: giveaway.prize,
                description: stripIndent(`
                Hosted by: ${giveaway.hostMention}
                Ends at: ${endDate}
                Winners: ${winnerMentions ? winnerMentions : "Not enough participants"}
                
                ${reqMessage}`),
                color: this.endEmbedColor,
                footer: {
                    text: `Created by: Raccoon#7867`
                }
            })
        }
    }

    /** 
     * @private
     */
    generateMentions(users) { // supporst 1 user, 1 user id, or an array of those     
        if (Array.isArray(users)) {
            if (!users.length) return false
            return users.map(c => {
                if (c instanceof User) return c.toString()
                else return `<@${c}>`
            })
        } else {
            if (c instanceof User) return c.toString()
            else return `<@${c}>`
        }
    }
}

module.exports = {
    GiveawayManager: GiveawayManager,
    giveaways: storedGiveaways,
    reroll: rerollDB
}