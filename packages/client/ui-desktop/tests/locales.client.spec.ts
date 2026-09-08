import { describe, expect, it } from 'vitest'
import { en, zh, type DesktopKey } from '../src/client/locales.ts'

const KEYS: readonly DesktopKey[] = Object.keys(zh) as DesktopKey[]

describe('desktop locale copy', () => {
  it('en and zh expose exactly the same key set, all non-empty', () => {
    for (const key of KEYS) {
      expect(zh[key], `zh.${key}`).toBeTruthy()
      expect(en[key], `en.${key}`).toBeTruthy()
    }
    expect(Object.keys(en)).toEqual(KEYS)
  })
})
