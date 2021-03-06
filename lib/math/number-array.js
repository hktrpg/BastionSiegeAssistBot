function getStdDeviation(numbers, average, distanceFunc = (base, other) => other - base) {
  const tmpVariance = numbers
    .map(o => distanceFunc(average, o))
    .map(o => o * o)
    .reduce((a, b) => a + b, 0)
  const variance = tmpVariance / numbers.length
  const stdDeviation = Math.sqrt(variance)
  return stdDeviation
}

function getSumAverageAmount(numbers) {
  const validNumbers = numbers.filter(o => o || o === 0)
  const sum = validNumbers.reduce((a, b) => a + b, 0)
  const amount = validNumbers.length
  const avg = sum / amount

  const stdDeviation = getStdDeviation(validNumbers, avg)

  return {
    amount,
    avg,
    min: Math.min(...validNumbers),
    max: Math.max(...validNumbers),
    stdDeviation,
    sum
  }
}

function getSumAverageAmountGroupedBy(array, keySelector, numberSelector) {
  const all = getSumAverageAmount(array.map(numberSelector))

  const grouped = array.reduce((col, add) => {
    const key = keySelector(add)
    if (!col[key]) {
      col[key] = []
    }

    col[key].push(numberSelector(add))
    return col
  }, {})

  const result = {}
  for (const key of Object.keys(grouped)) {
    result[key] = getSumAverageAmount(grouped[key])
  }

  return {
    all,
    grouped: result
  }
}

module.exports = {
  getStdDeviation,
  getSumAverageAmount,
  getSumAverageAmountGroupedBy
}
