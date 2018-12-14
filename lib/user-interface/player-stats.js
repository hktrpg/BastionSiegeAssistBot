const {ONE_DAY_IN_SECONDS} = require('../math/unix-timestamp')

const {emoji} = require('./output-emojis')
const {createAverageMaxString} = require('./number-array-strings')

function createPlayerStatsString(stats) {
  let text = `*${stats.player}*`

  if (stats.immune) {
    text += '\nThis player is an active user of this bot. You will not get any information from me. Do the same and get the same kind of protection. 🛡💙'
    return text
  }

  text += createArmyStatsBarLine(stats.armyAttack, emoji.army)
  text += createArmyStatsBarLine(stats.armyDefense, emoji.wall)
  const daysAgo = ((Date.now() / 1000) - stats.lastBattleTime) / ONE_DAY_IN_SECONDS

  text += `\nBattles observed: ${stats.battlesObserved}`
  if (isFinite(daysAgo)) {
    text += ` (≥${Math.round(daysAgo)}d ago)`
  }

  if (stats.attacksWithoutLossPercentage >= 0) {
    text += `\nInactive: ${Math.round(stats.attacksWithoutLossPercentage * 100)}%`
  }
  if (stats.loot.amount > 0) {
    text += '\n' + createAverageMaxString(stats.loot, 'Loot', emoji.gold, true)
  }
  if (stats.gems.amount > 0) {
    text += '\n' + createAverageMaxString(stats.gems, 'Gems', emoji.gem, true)
  }

  return text
}

function createArmyStatsBarLine(data, armyTypeEmoji) {
  let text = ''
  if (!data.min && !data.max) {
    return text
  }
  text += '\n'

  text += isFinite(data.min) ? data.min : '?????'

  text += ` < ${armyTypeEmoji} < `

  if (isFinite(data.max)) {
    text += data.max
    text += ' ('
    text += `${Math.round(data.maxPercentLost * 100)}%${emoji.army} lost`
    text += ')'
  } else {
    text += '?????'
  }
  return text
}

function createPlayerStatsShortString(stats) {
  let text = ''

  if (stats.immune) {
    text += '🛡💙 This player is an active user of this bot. You will not get any information from me.'
    return text
  }

  text += ` ${stats.battlesObserved} battle${stats.battlesObserved > 1 ? 's' : ''} observed (${stats.winsObserved}|${stats.lossesObserved}).`
  if (stats.attacksWithoutLossPercentage >= 0) {
    text += ` Inactive: ${Math.round(stats.attacksWithoutLossPercentage * 100)}%.`
  }
  if (stats.loot.amount > 0) {
    text += ' ' + createAverageMaxString(stats.loot, 'Loot', emoji.gold, true)
  }

  return text.trim()
}

module.exports = {
  createPlayerStatsString,
  createPlayerStatsShortString
}