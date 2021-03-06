const {inputTextCleanup, MYSTICS_TEXT_EN} = require('bastion-siege-logic')
const fuzzysort = require('fuzzysort')
const Telegraf = require('telegraf')

const {replaceLookingLikeAsciiChars} = require('../lib/javascript-abstraction/strings')

const playerStatsDb = require('../lib/data/playerstats-db')
const poweruser = require('../lib/data/poweruser')
const wars = require('../lib/data/wars')

const {getMidnightXDaysEarlier} = require('../lib/math/unix-timestamp')

const {createPlayerNameString, createPlayerStatsString, createPlayerStatsShortString} = require('../lib/user-interface/player-stats')
const {createWarOneLineString, createWarStats} = require('../lib/user-interface/war-stats')
const {emoji} = require('../lib/user-interface/output-text')
const {createList} = require('../lib/user-interface/inline-list')

const {Extra, Markup} = Telegraf

const bot = new Telegraf.Composer()

bot.on('inline_query', async ctx => {
  const {query} = ctx.inlineQuery
  const cleanedUpQuery = replaceLookingLikeAsciiChars(inputTextCleanup(query))
  const queryTestFunc = getTestFunctionForQuery(cleanedUpQuery)
  const offset = ctx.inlineQuery.offset || 0
  const now = Date.now() / 1000
  const isPoweruser = poweruser.isPoweruser(ctx.from.id)

  const statics = []
  const user = ctx.session.gameInformation.player
  if (isPoweruser) {
    const {timestamp, battle} = wars.getCurrent(now, user.name) || {}
    if (timestamp && battle) {
      statics.push({
        type: 'article',
        id: 'war',
        title: emoji.poweruser + ' ' + ctx.i18n.t('bs.war'),
        description: createWarOneLineString(battle),
        input_message_content: {
          message_text: createWarStats(now, battle, user) + '\n\n' + ctx.i18n.t('battle.inlineWar.info'),
          parse_mode: 'markdown'
        },
        reply_markup: Markup.inlineKeyboard([
          Markup.callbackButton(ctx.i18n.t('battle.inlineWar.updateButton'), `inlineWar:${user.alliance}:${user.name}`)
        ])
      })
    }

    const {text, keyboard} = createList(ctx.from.id, 'default', now)
    statics.push({
      type: 'article',
      id: 'list-default',
      title: emoji.list + emoji.poweruser + ' ' + ctx.i18n.t('list.title'),
      description: ctx.i18n.t('list.description'),
      input_message_content: {
        message_text: text,
        parse_mode: 'markdown'
      },
      reply_markup: keyboard
    })
  }

  const filteredStatics = statics
    .filter(o => queryTestFunc(JSON.stringify(o)))

  let players = []
  const options = {
    is_personal: true,
    cache_time: 20
  }

  if (!isPoweruser) {
    options.switch_pm_text = ctx.i18n.t('poweruser.usefulWhen') + ' ' + emoji.poweruser
    options.switch_pm_parameter = 'be-a-poweruser'
  }

  if (isPoweruser && query && query.length >= 1) {
    const allPlayers = playerStatsDb.list()
    const result = await fuzzysort.goAsync(cleanedUpQuery, allPlayers, {
      key: 'playerNameLookingLike'
    })
    players = result.map(o => o.obj.player)
  } else {
    // TODO: Currently only the english ones are in default search, mystics should be grouped by mystic, not by name
    const freeOptions = [...Object.values(MYSTICS_TEXT_EN)]

    if (user && ctx.session.gameInformation.playerTimestamp > getMidnightXDaysEarlier(now, poweruser.MAX_PLAYER_AGE_DAYS)) {
      freeOptions.push(user.name)
    }

    players = freeOptions
      .filter(o => queryTestFunc(o))
  }

  const playerResults = players
    .map(o => playerStatsDb.get(o))
    .slice(offset, offset + 20)
    .map(stats => {
      return {
        type: 'article',
        id: `player-${stats.player}`,
        title: createPlayerNameString(stats),
        description: createPlayerStatsShortString(stats),
        input_message_content: {
          message_text: createPlayerStatsString(stats),
          parse_mode: 'markdown'
        }
      }
    })

  if (players.length > offset + 20) {
    options.next_offset = offset + 20
  }

  if (process.env.NODE_ENV !== 'production') {
    options.cache_time = 2
  }

  return ctx.answerInlineQuery([
    ...filteredStatics,
    ...playerResults
  ], options)
})

function getTestFunctionForQuery(query) {
  try {
    const regex = new RegExp(query, 'i')
    return o => regex.test(o)
  } catch (error) {
    return o => o.includes(query)
  }
}

bot.action(/inlineWar:(.*):(.+)/, ctx => {
  const now = Date.now() / 1000
  const player = {
    alliance: ctx.match[1],
    name: ctx.match[2]
  }
  const {timestamp, battle} = wars.getCurrent(now, player.name) || {}
  if (!timestamp) {
    return ctx.editMessageText('This war seems over…')
  }

  wars.addInlineMessageToUpdate(now, player, ctx.callbackQuery.inline_message_id)
  const warText = createWarStats(timestamp, battle, player)
  return ctx.editMessageText(warText, Extra.markdown())
})

module.exports = {
  bot
}
