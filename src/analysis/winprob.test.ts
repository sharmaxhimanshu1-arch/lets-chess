import { describe, expect, it } from 'vitest'
import {
  gameAccuracy,
  gradeMove,
  moveAccuracy,
  winPercent,
  winPercentFor,
  winPercentLost,
} from './winprob'

describe('winPercent', () => {
  it('is 50% for an equal position', () => {
    expect(winPercent(0)).toBeCloseTo(50)
  })

  it('is symmetric and saturates for huge evaluations', () => {
    expect(winPercent(300) + winPercent(-300)).toBeCloseTo(100)
    expect(winPercent(5000)).toBeCloseTo(winPercent(1000))
  })

  it('treats a forced mate as (nearly) certain', () => {
    expect(winPercentFor({ mate: 2 }, 'w')).toBeGreaterThan(97)
    expect(winPercentFor({ mate: -2 }, 'b')).toBeGreaterThan(97)
  })
})

describe('winPercentLost / gradeMove', () => {
  it('flags hanging a knight in an equal position as a blunder', () => {
    // Equal before; after the move White is down a knight (~-300cp).
    const lost = winPercentLost({ cp: 0 }, { cp: -300 }, 'w')
    expect(gradeMove(lost)).toBe('blunder')
  })

  it('measures loss from Black’s point of view for Black moves', () => {
    expect(winPercentLost({ cp: 0 }, { cp: 300 }, 'b')).toBeGreaterThan(15)
    expect(winPercentLost({ cp: 0 }, { cp: -300 }, 'b')).toBe(0)
  })

  it('barely penalises small slips when already completely winning', () => {
    const lost = winPercentLost({ cp: 900 }, { cp: 700 }, 'w')
    expect(gradeMove(lost)).toBe('good')
  })

  it('maps thresholds to grades', () => {
    expect(gradeMove(3)).toBe('good')
    expect(gradeMove(7)).toBe('inaccuracy')
    expect(gradeMove(12)).toBe('mistake')
    expect(gradeMove(20)).toBe('blunder')
    expect(gradeMove(0, true)).toBe('best')
  })
})

describe('accuracy', () => {
  it('is ~100 for perfect moves and falls with losses', () => {
    expect(moveAccuracy(0)).toBeCloseTo(100, 0)
    expect(moveAccuracy(30)).toBeLessThan(30)
    expect(gameAccuracy([0, 0, 0])).toBeCloseTo(100, 0)
    expect(gameAccuracy([])).toBe(100)
  })
})
