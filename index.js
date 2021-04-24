const {
    Client,
    Message,
    Role,
    Collection
} = require('discord.js'),
    client = new Client({
        partials: ['MESSAGE', 'REACTION', 'USER']
    }),
    {
        GiveawayManager,
        giveaways,
        reroll
    } = require('./struct/GiveawayManager'), {
        prefix,
        token
    } = require('./config.json'),
    ms = require('ms'),
    fs = require('fs'),
    commandFiles = fs.readdirSync('./commands').filter(c => c.endsWith(".js"))

client.commands = new Collection()
client.manager = new GiveawayManager(client)

for (let file of commandFiles) {
    let command = require(`./commands/${file}`)
    client.commands.set(command.name, command)
}

client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch()
    if (reaction.message.partial) await reaction.message.fetch()

    await client.manager.manageReaction(reaction, user)
    
})

client.on('ready', () => {
    console.clear()
    console.log(`${client.user.tag} is online!`)
})

client.on('message', async message => {

    if (message.author.bot || !message.content.startsWith(prefix)) return;

    client.manager.add(message)
    let args = message.content.trim().slice(prefix.length).split(/\s+/g)
    let commandName = args.shift().toLowerCase()

    let command = client.commands.get(commandName) || client.commands.find(c => c.aliases && c.aliases.includes(commandName))

    if(!command) return;

    try {
        await command.execute(message, args, client)
    } catch (error) {
        message.channel.send("I had an error, please try again")
        console.log(error.stack)
    }
    
})

client.login(token)
