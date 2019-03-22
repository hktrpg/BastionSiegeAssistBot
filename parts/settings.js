const Telegraf = require('telegraf')
const TelegrafInlineMenu = require('telegraf-inline-menu')

const {toggleInArray} = require('../lib/javascript-abstraction/array')

const playerStatsDb = require('../lib/data/playerstats-db')
const poweruser = require('../lib/data/poweruser')

const {emoji} = require('../lib/user-interface/output-text')
const {BUILDINGS, getBuildingText, defaultBuildingsToShow} = require('../lib/user-interface/buildings')
const {alertEmojis} = require('../lib/user-interface/alert-handler')
const {createPlayerStatsString} = require('../lib/user-interface/player-stats')
const {getHintStrings, conditionEmoji, conditionTypeTranslation} = require('../lib/user-interface/poweruser')

const alertsMenu = require('./settings-submenus/alerts')
const languageMenu = require('./settings-submenus/language')

const settingsMenu = new TelegrafInlineMenu(ctx => `*${ctx.i18n.t('settings')}*`)
settingsMenu.setCommand('settings')

settingsMenu.submenu(ctx => alertEmojis.enabled + ' ' + ctx.i18n.t('alerts'), 'alerts', alertsMenu.menu)

function buildingsText(ctx) {
  let text = `*${ctx.i18n.t('bs.buildings')}*`
  text += '\n' + ctx.i18n.t('setting.buildings.infotext')
  return text
}

settingsMenu.submenu(ctx => emoji.houses + ' ' + ctx.i18n.t('bs.buildings'), 'buildings', new TelegrafInlineMenu(buildingsText))
  .select('b', BUILDINGS, {
    multiselect: true,
    columns: 2,
    textFunc: getBuildingText,
    setFunc: (ctx, key) => {
      ctx.session.buildings = toggleInArray(ctx.session.buildings || [...defaultBuildingsToShow], key)
    },
    isSetFunc: (ctx, key) => (ctx.session.buildings || [...defaultBuildingsToShow]).includes(key)
  })

settingsMenu.submenu(ctx => emoji.language + ' ' + ctx.i18n.t('language.title'), 'language', languageMenu.menu)

function poweruserText(ctx) {
  let text = emoji.poweruser + ` *${ctx.i18n.t('poweruser.poweruser')}*\n`

  const isPoweruser = poweruser.isPoweruser(ctx.from.id)
  if (isPoweruser) {
    text += ctx.i18n.t('poweruser.youare') + ' 😍\n'
  } else {
    text += ctx.i18n.t('poweruser.notyet') + ' 😔\n'
  }

  const conditions = poweruser.getConditions(ctx.from.id)
  text += conditions
    .map(o => `${conditionEmoji(o)} ${conditionTypeTranslation(ctx, o.type)}`)
    .join('\n')

  if (isPoweruser) {
    text += '\n'
    const {name} = ctx.session.gameInformation.player || {}
    const {disableImmunity} = ctx.session
    if (disableImmunity) {
      text += '\n' + ctx.i18n.t('poweruser.immunityDisabled')
    } else {
      if (name) {
        text += '\n' + ctx.i18n.t('poweruser.immunityTo', {name: '`' + name + '`'})
      } else {
        text += '\n' + ctx.i18n.t('poweruser.noname')
      }

      text += '\n' + ctx.i18n.t('name.update')
    }

    if (name) {
      const stats = playerStatsDb.get(name)
      text += '\n\n' + createPlayerStatsString(stats)
    }
  }

  const hints = getHintStrings(ctx, conditions)
  if (hints.length > 0) {
    text += '\n\n' + hints
      .join('\n\n')
  }

  return text
}

settingsMenu.submenu(ctx => emoji.poweruser + ' ' + ctx.i18n.t('poweruser.poweruser'), 'poweruser', new TelegrafInlineMenu(poweruserText))
  .setCommand('poweruser')
  .toggle(ctx => emoji.immunity + ' ' + ctx.i18n.t('poweruser.immunity'), 'immunity', {
    hide: ctx => !poweruser.isPoweruser(ctx.from.id),
    setFunc: (ctx, newState) => {
      if (newState) {
        delete ctx.session.disableImmunity
      } else {
        ctx.session.disableImmunity = true
      }
    },
    isSetFunc: ctx => !ctx.session.disableImmunity
  })

const bot = new Telegraf.Composer()
bot.use(settingsMenu.init({
  backButtonText: ctx => `🔙 ${ctx.i18n.t('menu.back')}…`,
  actionCode: 'settings'
}))

module.exports = {
  bot
}
