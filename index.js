const fs = require('fs')
const Telegraf = require('telegraf')

const userSessions = require('./lib/data/user-sessions')

const partAlerts = require('./parts/alerts')

const bastionsiegeforward = require('./parts/bastionsiegeforward')
const inlineQuery = require('./parts/inline-query')
const partHints = require('./parts/hints')

const partAssumed = require('./parts/assumed')
const partBattlereport = require('./parts/battlereport')
const partBattleStats = require('./parts/battlestats')
const partBotStats = require('./parts/bot-stats')
const partBuildings = require('./parts/buildings')
const partEffects = require('./parts/effects')
const partPlayerStats = require('./parts/playerstats')
const partSettings = require('./parts/settings')
const partWar = require('./parts/war')

const {Extra, Markup} = Telegraf

const tokenFilePath = process.env.NODE_ENV === 'production' ? process.env.npm_package_config_tokenpath : process.env.npm_package_config_tokenpathdebug
const token = fs.readFileSync(tokenFilePath, 'utf8').trim()
const bot = new Telegraf(token)

// For handling group/supergroup commands (/start@your_bot) you need to provide bot username.
bot.telegram.getMe().then(botInfo => {
  bot.options.username = botInfo.username
})

if (process.env.NODE_ENV !== 'production') {
  bot.use(async (ctx, next) => {
    const identifier = [
      new Date().toISOString(),
      Number(ctx.update.update_id).toString(16),
      ctx.from && ctx.from.first_name,
      ctx.updateType
    ].join(' ')
    const callbackData = ctx.callbackQuery && ctx.callbackQuery.data
    const inlineQuery = ctx.inlineQuery && ctx.inlineQuery.query
    const messageText = ctx.message && ctx.message.text
    const data = callbackData || inlineQuery || messageText
    console.time(identifier)
    await next()
    if (data) {
      console.timeLog(identifier, data.length, data.replace(/\n/g, '\\n').substr(0, 50))
    } else {
      console.timeLog(identifier)
    }
  })
}

bot.use(async (ctx, next) => {
  try {
    await next()
  } catch (error) {
    if (error.message.indexOf('Too Many Requests') >= 0) {
      console.log('Telegraf Too Many Requests error. Skip.', error)
      return
    }

    console.log('try to send error to user', ctx.update, error)
    let text = '🔥 Something went wrong here!'
    text += '\n'
    text += 'You should join the Support Group and report this error. Let us make this bot even better together. ☺️'

    text += '\n'
    text += '\nError: `'
    text += error.message
    text += '`'

    const target = (ctx.chat || ctx.from).id
    const keyboard = Markup.inlineKeyboard([
      Markup.urlButton('Join BastionSiegeAssist Support Group', 'https://t.me/joinchat/AC0dV1dG2Y7sOFQPtZm9Dw')
    ], {columns: 1})
    return ctx.tg.sendMessage(target, text, Extra.markdown().markup(keyboard))
  }
})

bot.use(userSessions)

// Fix previous bot problems
bot.use((ctx, next) => {
  if (ctx.session.gameInformation) {
    const allKeys = Object.keys(ctx.session.gameInformation)
    const keysWithValueNull = allKeys
      .filter(o => ctx.session.gameInformation[o] === null)

    keysWithValueNull
      .forEach(o => {
        delete ctx.session.gameInformation[o]
      })
  }

  return next()
})

partAlerts.start(bot.telegram)
bot.use(partAlerts.bot)

bot.use(bastionsiegeforward.bot)
bot.use(inlineQuery.bot)
bot.use(partHints.bot)

bot.use(partAssumed.bot)
bot.use(partBattlereport.bot)
bot.use(partBattleStats.bot)
bot.use(partBotStats.bot)
bot.use(partBuildings.bot)
bot.use(partEffects.bot)
bot.use(partPlayerStats.bot)
bot.use(partSettings.bot)
bot.use(partWar.bot)

bot.on('text', (ctx, next) => {
  if (!ctx.message.forward_from && ctx.chat.id === ctx.from.id &&
    (ctx.message.text.indexOf('Battles observed') >= 0 ||
    ctx.message.text.indexOf('🛡💙 This player is an active user of this bot.') >= 0)
  ) {
    // Thats an inline query. Ignore :)
    return
  }

  return next()
})

bot.use(ctx => {
  let text = `Hey ${ctx.from.first_name}!\n`

  text += '\nYou should forward ingame screens from @BastionSiegeBot to me.'

  text += '\n'
  text += '\nWith forwarded screens that contain your current buildings or resources I can predict when upgrades are ready.'

  text += '\n'
  text += '\nWith battle reports I can show your history in battles.'
  text += ' Forwarding the "Your scouts found" message shows information about that player like possible loot and required army.'
  text += ' See more about the search in the /settings → Search.'

  text += '\n'
  text += '\nBattlereports you provide will only be used to assume the enemies strength.'
  text += ' Your own data known to me will not be considered to tell others your strength.'
  text += ' It gets even better: As long as you are actively providing data to me you will get immunity and no one can use me to check on you.'

  text += '\n'
  text += '\nSee /settings for more in depth usages of this bot.'

  text += '\n'
  text += '\nYou have an idea or found a bug? Join the BastionSiegeAssist Support Group with the button below and share it. Let us make this bot even better :)'

  const keyboard = Markup.inlineKeyboard([
    Markup.switchToCurrentChatButton('try player search…', 'Dragon'),
    Markup.urlButton('Join BastionSiegeAssist Support Group', 'https://t.me/joinchat/AC0dV1dG2Y7sOFQPtZm9Dw')
  ], {columns: 1})
  return ctx.replyWithMarkdown(text, Extra.markup(keyboard))
})

bot.catch(error => {
  console.error('Telegraf Error', error.response || error)
})

bot.startPolling()
