import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, migrateSettings, SETTINGS_VERSION } from './settings'

describe('migrateSettings', () => {
  it('moves version-1 records off the old default depth of 14', () => {
    const v1 = { username: 'me', depth: 14, maxGames: 30 }
    expect(migrateSettings(v1)).toEqual({ ...v1, depth: 12, settingsVersion: SETTINGS_VERSION })
  })

  it('keeps a depth the user picked themselves', () => {
    expect(migrateSettings({ username: 'me', depth: 16, maxGames: 10 }).depth).toBe(16)
  })

  it('leaves current records alone', () => {
    const current = { ...DEFAULT_SETTINGS, username: 'me', depth: 14 }
    expect(migrateSettings(current)).toEqual(current)
  })
})
