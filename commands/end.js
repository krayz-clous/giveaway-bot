const Discord = require('discord.js'),
{
    giveaways
} = require('../struct/GiveawayManager')

module.exports = {
    name: "end",
    description: "End a giveaway ",
    usage: 'reroll <message id>',

    /**
     * 
     * @param {Discord.Message} message 
     * @param {string[]} args 
     * @param {Discord.Client} client 
     */

    execute: async function (message, args, client) {
        let id = args[0]
        if (!id) return message.channel.send("Please provide a giveaway id to end (message id)")

        try {
            let endGiveaway = giveaways.get(`giveaways_${message.guild.id}_${id}`)
            let channel = message.guild.channels.cache.get(endGiveaway.channel)
            let msg = await channel.messages.fetch(id)

            await client.manager.end(msg, endGiveaway)
        } catch (e) {
            console.log(e.stack)
        }
    }
}