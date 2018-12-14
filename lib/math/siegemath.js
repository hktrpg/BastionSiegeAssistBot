// Array Content: gold, wood, stone
const buildingCostFactors = {
  townhall: [250, 100, 100],
  storage: [100, 50, 50],
  houses: [100, 50, 50],
  farm: [50, 25, 25],
  sawmill: [50, 25, 25],
  mine: [50, 25, 25],
  barracks: [100, 50, 50],
  wall: [2500, 250, 750],
  trebuchet: [4000, 500, 150],
  ballista: [5000, 350, 50]
}

function calcGoldCapacity(townhallLevel) {
  return 500000 * townhallLevel
}

function calcGoldIncome(townhallLevel, housesLevel) {
  // 0.1 * 20 = 1 * 2
  // return (0.5 + 0.1 * townhallLevel) * housesLevel * 20
  return (5 + townhallLevel) * housesLevel * 2
}

function calcProduction(productionBuildingLevel) {
  return 10 * productionBuildingLevel
}

function calcProductionFood(farmLevel, housesLevel) {
  // Exact would be the following but it can be more calculated more efficiently
  // return calcProduction(farmLevel) - housesLevel * 20 / 2
  return (farmLevel - housesLevel) * 10
}

function calcStorageCapacity(storageLevel) {
  return 50 * storageLevel * (storageLevel + 20)
}

function calcStorageLevelNeededForUpgrade(building, wantedBuildingLevel) {
  const maxResourceFactor = Math.max(buildingCostFactors[building][1], buildingCostFactors[building][2])
  const resourceLimitNeeded = maxResourceFactor * wantedBuildingLevel * (wantedBuildingLevel + 1)

  const tmp1 = Math.sqrt(2)
  const tmp2 = Math.sqrt(resourceLimitNeeded + 5000)
  const tmp3 = (tmp1 * tmp2) - 100
  const tmp4 = tmp3 / 10
  const levelRequired = Math.ceil(tmp4)

  return levelRequired
}

function calcTownhallLevelNeededForUpgrade(building, wantedBuildingLevel) {
  const goldFactor = buildingCostFactors[building][0]
  const resourceLimitNeeded = goldFactor * wantedBuildingLevel * (wantedBuildingLevel + 1)

  const tmp1 = resourceLimitNeeded / 500000
  const levelRequired = Math.ceil(tmp1)
  return levelRequired
}

function calcBuildingCost(building, currentBuildingLevel) {
  return {
    gold: buildingCostFactors[building][0] * (currentBuildingLevel + 1) * (currentBuildingLevel + 2),
    wood: buildingCostFactors[building][1] * (currentBuildingLevel + 1) * (currentBuildingLevel + 2),
    stone: buildingCostFactors[building][2] * (currentBuildingLevel + 1) * (currentBuildingLevel + 2)
  }
}

function calcBuildingCostUntil(building, currentBuildingLevel, targetLevel) {
  const sum = {gold: 0, wood: 0, stone: 0}
  for (let i = currentBuildingLevel; i < targetLevel; i++) {
    const cost = calcBuildingCost(building, i)
    sum.gold += cost.gold
    sum.wood += cost.wood
    sum.stone += cost.stone
  }
  return sum
}

// Semitotal Gold is the amount of gold needed in order to buy everything.
// Gold is much fast to get and buy the resources with it than the buildings gather them
// so this will be kinda wrong on low levels were you could sell resources in order to get gold
function calcSemitotalGold({gold, wood, stone}) {
  return gold + (wood * 2) + (stone * 2)
}

function calcSemitotalGoldIncome(buildings) {
  return calcGoldIncome(buildings.townhall, buildings.houses) +
    (calcProduction(buildings.sawmill) * 2) +
    (calcProduction(buildings.mine) * 2)
}

function calcMinutesNeeded(cost, buildings, currentResources) {
  const needed = {
    gold: cost.gold - currentResources.gold,
    wood: Math.max(0, cost.wood - currentResources.wood),
    stone: Math.max(0, cost.stone - currentResources.stone)
  }
  const semitotalNeeded = Math.max(0, calcSemitotalGold(needed))

  const income = calcSemitotalGoldIncome({
    townhall: buildings.townhall,
    houses: buildings.houses,
    sawmill: needed.wood === 0 ? 0 : buildings.sawmill,
    mine: needed.stone === 0 ? 0 : buildings.mine
  })

  return Math.ceil(semitotalNeeded / income)
}

function calcMinutesNeededForUpgrade(building, currentBuildingLevel, buildings, currentResources) {
  const cost = calcBuildingCost(building, currentBuildingLevel)
  return calcMinutesNeeded(cost, buildings, currentResources)
}

function calcMinutesNeededToFillStorage(buildings, currentResources) {
  const storageSize = calcStorageCapacity(buildings.storage)
  const woodNeeded = storageSize - currentResources.wood
  const stoneNeeded = storageSize - currentResources.stone
  const foodNeeded = storageSize - currentResources.food

  const goldIncome = calcGoldIncome(buildings.townhall, buildings.houses)
  const woodIncome = calcProduction(buildings.sawmill)
  const stoneIncome = calcProduction(buildings.mine)
  const foodIncome = calcProductionFood(buildings.farm, buildings.houses)

  const onlyWoodNeededMinutes = woodNeeded / woodIncome
  const onlyStoneNeededMinutes = stoneNeeded / stoneIncome
  const onlyFoodNeededMinutes = foodNeeded / foodIncome

  // Calculate first the time when everything is producing the whole time
  // This will be wrong when a resource already is full earlier but its needed in order to determine this more or less great
  let combinedNeedFirstApprox = woodNeeded + stoneNeeded + foodNeeded - (currentResources.gold / 2)
  combinedNeedFirstApprox = Math.max(0, combinedNeedFirstApprox)
  const combinedIncomeFirstApprox = woodIncome + stoneIncome + foodIncome + (goldIncome / 2)
  const combinedMinutesNeededFirstApprox = Math.ceil(combinedNeedFirstApprox / combinedIncomeFirstApprox)

  let combinedNeed = -currentResources.gold / 2
  let combinedIncome = goldIncome / 2

  if (onlyWoodNeededMinutes >= combinedMinutesNeededFirstApprox) {
    combinedNeed += woodNeeded
    combinedIncome += woodIncome
  }

  if (onlyStoneNeededMinutes >= combinedMinutesNeededFirstApprox) {
    combinedNeed += stoneNeeded
    combinedIncome += stoneIncome
  }

  if (foodIncome <= 0 ||
      onlyFoodNeededMinutes >= combinedMinutesNeededFirstApprox) {
    combinedNeed += foodNeeded
    combinedIncome += foodIncome
  }

  combinedNeed = Math.max(0, combinedNeed)
  const minutesNeeded = Math.ceil(combinedNeed / combinedIncome)

  return minutesNeeded
}

function estimateResourcesAfterTimespan(currentResources, buildings, minutes) {
  const goldIncome = calcGoldIncome(buildings.townhall, buildings.houses)
  const woodIncome = calcProduction(buildings.sawmill)
  const stoneIncome = calcProduction(buildings.mine)
  const foodIncome = calcProductionFood(buildings.farm, buildings.houses)

  const goldLimit = calcGoldCapacity(buildings.townhall)
  const storageLimit = calcStorageCapacity(buildings.storage)

  const estimated = {
    gold: currentResources.gold + (goldIncome * minutes),
    wood: currentResources.wood + (woodIncome * minutes),
    stone: currentResources.stone + (stoneIncome * minutes),
    food: currentResources.food + (foodIncome * minutes)
  }

  const estimatedWithLimits = {
    gold: Math.min(goldLimit, estimated.gold),
    wood: Math.min(storageLimit, estimated.wood),
    stone: Math.min(storageLimit, estimated.stone),
    food: Math.min(storageLimit, Math.max(0, estimated.food))
  }

  return estimatedWithLimits
}

module.exports = {
  calcGoldCapacity,
  calcGoldIncome,
  calcProduction,
  calcProductionFood,
  calcStorageCapacity,
  calcStorageLevelNeededForUpgrade,
  calcTownhallLevelNeededForUpgrade,

  calcBuildingCost,
  calcBuildingCostUntil,
  calcSemitotalGold,
  calcSemitotalGoldIncome,

  calcMinutesNeeded,
  calcMinutesNeededForUpgrade,
  calcMinutesNeededToFillStorage,
  estimateResourcesAfterTimespan
}