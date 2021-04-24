const Discord = require('discord.js'),
    {
        reroll
    } = require('../struct/GiveawayManager')

module.exports = {
    name: "reroll",
    description: "Reroll an ended giveaway",
    usage: 'reroll <message id>',

    /**
     * 
     * @param {Discord.Message} message 
     * @param {string[]} args 
     * @param {Discord.Client} client 
     */

    execute: async function (message, args, client) {
        let id = args[0]
        if (!id) return message.channel.send("Please provide a giveaway id to reroll (message id)")

        try {
            let reGiveaway = reroll.get(`giveaways_${message.guild.id}_${id}`)
            let channel = message.guild.channels.cache.get(reGiveaway.channel)
            let msg = await channel.messages.fetch(id)

            await client.manager.reroll(msg, reGiveaway)
        } catch (e) {
            console.log(e.stack)
        }
    }
}