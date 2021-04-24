const Discord = require('discord.js'),
    ms = require('ms')

module.exports = {
    name: "start",
    description: "Start a giveaway",
    usage: "start <time> <winners> <guild invite or none> <@role or none> <messages or none> <prize>",

    /**
     * 
     * @param {Discord.Message} message 
     * @param {string[]} args 
     * @param {Discord.Client} client 
     */

    execute: async function (message, args, client) {
        let [time, winners, guild, role, messages, ...prize] = args
        if(!time || !winners || !guild || !role || !messages || !prize.length) return message.channel.send(`Please use this command correctly \`\`\`${this.usage}\`\`\``)
        time = ms(time)
        winners = parseInt(winners)

        if (guild !== "none") {
            guild = (await client.fetchInvite(guild).catch(() => {})).guild
        } else {
            guild = false
        }

        role = role !== "none" ? parseRole(message, role) : false
        messages = messages !== "none" ? parseInt(messages) : false

        if (isNaN(time) || !time) return message.channel.send("Please provide a valid time")
        if (isNaN(winners) || !winners) return message.channel.send("Please provide a valid winners")
        if (!prize.length) return message.channel.send("Please provide a prize")

        await client.manager.create(message.channel, message, {
            time: time,
            winners: winners,
            prize: prize.join(" "),
            reqGuild: guild,
            reqRole: role,
            reqMessage: messages
        })
    }
}


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