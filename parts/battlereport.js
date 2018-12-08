const Telegraf = require('telegraf')

const battlereports = require('../lib/battlereports')
const playerStats = require('../lib/player-stats')
const playerStatsSearch = require('../lib/player-stats-search')

const {emoji} = require('../lib/gamescreen.emoji')
const {formatNumberShort, getMidnightXDaysEarlier} = require('../lib/number-functions')
const {createPlayerStatsString} = require('../lib/create-stats-strings')

const {Extra, Markup} = Telegraf

const bot = new Telegraf.Composer()

function isBattleReport(ctx) {
  return ctx.state.screen && (
    ctx.state.screen.type === 'battlereport' ||
    ctx.state.screen.type === 'alliance-battlereport'
  )
}

// Save battlereport
bot.on('text', Telegraf.optional(isBattleReport, async ctx => {
  const report = ctx.state.screen.information.battlereport
  const {timestamp} = ctx.state.screen

  const {reportsRaw} = await battlereports.load(ctx.from.id)
  const isNew = !reportsRaw[timestamp]
  if (isNew) {
    await battlereports.add(ctx.from.id, timestamp, report, ctx.message.text)
  }

  let text = '*Battlereport*'

  const baseExtra = Extra
    .markdown()
    .inReplyTo(ctx.message.message_id)

  if (!report) {
    text += '\nSomething seems fishy here. Please tell @BastionSiegeAssist in order to get this fixed. 😇'
    return ctx.reply(text, baseExtra)
  }

  const allBattlereports = await battlereports.getAll()
  const {attack, won, terra, reward, gems, karma} = report

  const {resourceTimestamp} = ctx.session.gameInformation
  if (isNew && timestamp > resourceTimestamp) {
    ctx.session.gameInformation.resources.gold += reward
  }
  if (attack) {
    const timestampType = ctx.state.screen.type === 'alliance-battlereport' ? 'battleAllianceTimestamp' : 'battleSoloTimestamp'
    ctx.session.gameInformation[timestampType] = Math.max(ctx.session.gameInformation[timestampType] || 0, timestamp)
  }

  const buttons = [
    [
      Markup.callbackButton('Your Battle Stats', 'battlestats')
    ]
  ]
    .concat(
      report.enemies.map(
        o => Markup.switchToChatButton(`Share ${o}…`, o)
      ).map(o => [o])
    )
  const markup = Markup.inlineKeyboard(buttons)

  text += '\n'
  text += attack ? emoji.army : emoji.wall
  text += won ? '🎉' : '😭'
  text += ' '
  const additionalStats = []
  if (terra) {
    additionalStats.push(formatNumberShort(terra, true) + emoji.terra)
  }
  additionalStats.push(formatNumberShort(reward, true) + emoji.gold)
  if (gems) {
    additionalStats.push(formatNumberShort(gems, true) + emoji.gem)
  }
  if (karma) {
    additionalStats.push(formatNumberShort(karma, true) + emoji.karma)
  }
  text += additionalStats.join(' ')

  if (isNew) {
    text += '\nThanks for that. I added it 👌'

    if (!ctx.session.search) {
      ctx.session.search = {}
    }
    const me = report.friends[0] // Wrong for alliance battles but they are not considered here.
    const relevantDays = 2
    const minDate = getMidnightXDaysEarlier(Date.now() / 1000, relevantDays)
    const relevantReports = allBattlereports
      // Only solo battles are valued. Adding Alliance battles will end within the min(1)
      .filter(o => o.friends.length === 1)
      .filter(o => o.friends[0] === me)
      .filter(o => o.time > minDate)

    const reward = relevantReports.length / relevantDays / 5
    const rewardFinal = Math.min(1, Math.max(5, Math.round(reward)))
    ctx.session.search.remainingSearches = playerStatsSearch.newSearchLimitAfterReward(ctx.session.search.remainingSearches, rewardFinal)
  } else {
    text += '\nYou have sent me this one already 🙃'
  }

  text += '\n\n'
  text += report.enemies
    .map(o => playerStats.generate(allBattlereports, o))
    .map(o => createPlayerStatsString(allBattlereports, o))
    .join('\n\n')

  return ctx.reply(text, baseExtra.markup(markup))
}))

module.exports = {
  bot
}
