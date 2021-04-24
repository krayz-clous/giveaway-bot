const {
    Client,
    Message,
    Role
} = require('discord.js')
const client = new Client({
    partials: ['MESSAGE', 'REACTION', 'USER']
})
const {
    GiveawayManager,
    giveaways,
    reroll
} = require('./struct/GiveawayManager')
const {
    prefix,
    token
} = require('./config.json')
const manager = new GiveawayManager(client)
const ms = require('ms')

client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch()
    if (reaction.message.partial) await reaction.message.fetch()

    let entryAD = await manager.manageReaction(reaction, user)
    if (!entryAD?.passed) {
        await reaction.users.remove(user)
        user.send(`ENTRY DENIED!\nMissing requirement: ${entryAD?.reason}`)
    } else {
        user.send("ENTRY ACCEPTED")
    }
})

client.on('ready', () => {
    console.clear()
    console.log(`${client.user.tag} is online!`)
})

client.on('message', async message => {

    if (message.author.bot || !message.content.startsWith(prefix)) return;

    manager.add(message)
    let args = message.content.trim().slice(prefix.length).split(/\s+/g)
    let command = args.shift().toLowerCase()

    if (command === "start") {
        let [time, winners, guild, role, messages, ...prize] = args
        time = ms(time)
        winners = parseInt(winners)

        if(guild !== "none") {
            guild = (await client.fetchInvite(guild).catch(() => {})).guild
        } else {
            guild = false
        }

        role = role !== "none" ? parseRole(message, role) : false
        messages = messages !== "none" ? parseInt(messages) : false

        if (isNaN(time) || !time) return message.channel.send("Please provide a valid time")
        if (isNaN(winners) || !winners) return message.channel.send("Please provide a valid winners")
        if (!prize.length) return message.channel.send("Please provide a prize")

        await manager.create(message.channel, message, {
            time: time,
            winners: winners,
            prize: prize.join(" "),
            reqGuild: guild,
            reqRole: role,
            reqMessage: messages
        })
    }

    if (command === "end") {
        let id = args[0]
        if (!id) return message.channel.send("Please provide a giveaway id to end (message id)")

        try {
            let endGiveaway = giveaways.get(`giveaways_${message.guild.id}_${id}`)
            let channel = message.guild.channels.cache.get(endGiveaway.channel)
            let msg = await channel.messages.fetch(id)

            await manager.end(msg, endGiveaway)
        } catch (e) {
            console.log(e.stack)
        }
    } 
    if(command === "reroll") {
        let id = args[0]
        if (!id) return message.channel.send("Please provide a giveaway id to reroll (message id)")

        try {
            let reGiveaway = reroll.get(`giveaways_${message.guild.id}_${id}`)
            let channel = message.guild.channels.cache.get(reGiveaway.channel)
            let msg = await channel.messages.fetch(id)

            await manager.reroll(msg, reGiveaway)
        } catch (e) {
            console.log(e.stack)
        }
    }
})

client.login(token)

/**
 * 
 * @param {Message} message 
 * @param {string} role 
 * @returns {Role} 
 */

function parseRole(message, role) {
    let reg = /^<@&(\d+)>$/
    let response = null;
    if (!role || typeof role !== "string") return;
    if (role.match(reg)) {
        const id = role.match(reg)[1];
        response = message.guild.roles.cache.get(id)
        if (response) return response;
    }
    response = message.guild.roles.cache.get(role)
    return response;
}