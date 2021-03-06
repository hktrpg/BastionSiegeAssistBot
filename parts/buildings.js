const debounce = require('debounce-promise')
const Telegraf = require('telegraf')
const TelegrafInlineMenu = require('telegraf-inline-menu')
const {calcMaxBuildingLevel, estimateResourcesAfter} = require('bastion-siege-logic')

const {calculateSecondsFromTimeframeString} = require('../lib/math/timeframe')

const {whenScreenContainsInformation} = require('../lib/input/gamescreen')

const {emoji} = require('../lib/user-interface/output-text')
const {
  BUILDINGS,
  createBuildingCostPerWinChanceLine,
  createBuildingMaxLevelStatsString,
  createBuildingTimeStatsString,
  createCapacityStatsString,
  createFillTimeStatsString,
  createIncomeStatsString,
  defaultBuildingsToShow
} = require('../lib/user-interface/buildings')
const {DEFAULT_HISTORY_TIMEFRAME, buildingsHistoryGraphFromContext} = require('../lib/user-interface/buildings-history')

const buildingsMenu = require('./settings-submenus/buildings')

const DEBOUNCE_TIME = 200 // Milliseconds

const VIEWS = [
  'upgrades',
  'history',
  'fillStorage',
  'income',
  'winChances'
]
const DEFAULT_VIEW = VIEWS[0]

const WIN_CHANCE_INFLUENCERS = ['barracks', 'trebuchet', 'wall']

const bot = new Telegraf.Composer()

const menu = new TelegrafInlineMenu(generateStatsText, {
  photo: generateStatsPhoto
})
  .setCommand('buildings')

const replyMenuMiddleware = menu.replyMenuMiddleware().middleware()

const debouncedBuildStats = {}
bot.on('text', whenScreenContainsInformation(['buildings', 'resources', 'workshop'], ctx => {
  const {id} = ctx.from
  if (!debouncedBuildStats[id]) {
    debouncedBuildStats[id] = debounce(replyMenuMiddleware, DEBOUNCE_TIME)
  }

  debouncedBuildStats[id](ctx)
}))

menu.submenu(ctx => emoji.houses + ' ' + ctx.i18n.t('bs.buildings'), 'buildings', buildingsMenu.menu, {
  hide: ctx => (ctx.session.buildingsView || DEFAULT_VIEW) !== 'upgrades'
})

menu.select('t', ['1 min', '15 min', '30 min', '1h', '6h', '12h', '1d', '2d', '7d', '30d'], {
  columns: 5,
  setFunc: (ctx, key) => {
    ctx.session.buildingsTimeframe = key
  },
  isSetFunc: (ctx, key) => key === (ctx.session.buildingsTimeframe || '1 min'),
  hide: ctx => (ctx.session.buildingsView || DEFAULT_VIEW) !== 'income'
})

menu.select('historyT', ['7d', '14d', '28d', '90d'], {
  hide: ctx => (ctx.session.buildingsView || DEFAULT_VIEW) !== 'history',
  isSetFunc: (ctx, key) => key === (ctx.session.buildingsHistoryTimeframe || DEFAULT_HISTORY_TIMEFRAME),
  setFunc: (ctx, key) => {
    ctx.session.buildingsHistoryTimeframe = key
  }
})

menu.select('view', VIEWS, {
  columns: 2,
  hide: ctx => creationNotPossibleReason(ctx) !== false,
  textFunc: (ctx, key) => ctx.i18n.t('buildings.' + key),
  isSetFunc: (ctx, key) => (ctx.session.buildingsView || DEFAULT_VIEW) === key,
  setFunc: (ctx, key) => {
    ctx.session.buildingsView = key
  }
})

bot.use(menu.init({
  backButtonText: ctx => `🔙 ${ctx.i18n.t('menu.back')}…`,
  actionCode: 'buildings'
}))

function creationNotPossibleReason(ctx) {
  const information = ctx.session.gameInformation

  if (!information.buildingsTimestamp) {
    return ctx.i18n.t('buildings.need.buildings')
  }

  if (!information.resourcesTimestamp) {
    return ctx.i18n.t('buildings.need.resources')
  }

  return false
}

function creationWarnings(ctx) {
  const information = ctx.session.gameInformation
  const warnings = []

  // Unix timestamp just without seconds (/60)
  const currentTimestamp = Math.floor(Date.now() / 1000 / 60)
  const resourceAgeMinutes = currentTimestamp - Math.floor(information.resourcesTimestamp / 60)
  const buildingAgeMinutes = currentTimestamp - Math.floor(information.buildingsTimestamp / 60)

  if (resourceAgeMinutes > 30) {
    warnings.push(ctx.i18n.t('buildings.old.resources'))
  }

  if (buildingAgeMinutes > 60 * 5) {
    warnings.push(ctx.i18n.t('buildings.old.buildings'))
  }

  return warnings
}

async function generateStatsPhoto(ctx) {
  if (creationNotPossibleReason(ctx)) {
    return
  }

  const selectedView = ctx.session.buildingsView || DEFAULT_VIEW
  if (selectedView === 'history') {
    const buffer = await buildingsHistoryGraphFromContext(ctx)
    return {source: buffer}
  }
}

function generateStatsText(ctx) {
  const notPossibleReason = creationNotPossibleReason(ctx)
  if (notPossibleReason) {
    return notPossibleReason
  }

  const information = ctx.session.gameInformation
  const buildings = {...information.buildings, ...information.workshop}

  const currentTimestamp = Math.floor(Date.now() / 1000 / 60)
  const resourceAgeMinutes = currentTimestamp - Math.floor(information.resourcesTimestamp / 60)
  const estimatedResources = estimateResourcesAfter(information.resources, buildings, resourceAgeMinutes)

  let text = ''

  const selectedView = ctx.session.buildingsView || DEFAULT_VIEW
  if (selectedView === 'upgrades') {
    const buildingsToShow = BUILDINGS
      .filter(o => (ctx.session.buildings || defaultBuildingsToShow).includes(o))

    text += `*${ctx.i18n.t('buildings.upgrades')}*\n`
    text += buildingsToShow
      .map(o => createBuildingTimeStatsString(o, buildings, estimatedResources))
      .join('\n')

    const upgradeable = buildingsToShow
      .filter(o => o !== 'storage')
      .filter(o => calcMaxBuildingLevel(o, buildings) > buildings[o])

    if (upgradeable.length > 0) {
      text += '\n\n'
      text += `*${ctx.i18n.t('buildings.maxPossible')}*\n`
      text += upgradeable
        .map(o => createBuildingMaxLevelStatsString(o, buildings, estimatedResources))
        .join('\n')
    }
  } else if (selectedView === 'fillStorage') {
    text += `*${ctx.i18n.t('buildings.fillStorage')}*\n`
    text += createFillTimeStatsString(buildings, estimatedResources).trim()
  } else if (selectedView === 'income') {
    text += `*${ctx.i18n.t('buildings.capacity')}*\n`
    text += createCapacityStatsString(buildings).trim()
    text += '\n\n'

    const timeframe = ctx.session.buildingsTimeframe || '1 min'
    const seconds = calculateSecondsFromTimeframeString(timeframe)
    const minutes = seconds / 60

    text += `*${ctx.i18n.t('buildings.income')}* (${timeframe})\n`
    text += createIncomeStatsString(buildings, minutes).trim()
  } else if (selectedView === 'winChances') {
    text += `*${ctx.i18n.t('buildings.winChances')}*\n`
    text += ctx.i18n.t('buildings.winChance.info')

    text += '\n'
    text += `*${ctx.i18n.t('battle.solo')}*\n`
    text += WIN_CHANCE_INFLUENCERS
      .map(building =>
        createBuildingCostPerWinChanceLine('solo', building, buildings[building])
      )
      .join('\n')

    text += '\n\n'
    text += `*${ctx.i18n.t('battle.alliance')}*\n`
    text += WIN_CHANCE_INFLUENCERS
      .map(building =>
        createBuildingCostPerWinChanceLine('alliance', building, buildings[building])
      )
      .join('\n')
  }

  text += '\n\n'

  const warnings = creationWarnings(ctx)
  text += warnings
    .map(o => '⚠️ ' + o)
    .join('\n')

  return text
}

module.exports = {
  bot
}
