const K = 32

export function calculateElo(winnerScore: number, loserScore: number) {
  const expected = 1 / (1 + Math.pow(10, (loserScore - winnerScore) / 400))
  const change = Math.round(K * (1 - expected))
  return {
    winnerNewScore: winnerScore + change,
    loserNewScore: loserScore - change,
    change,
  }
}
