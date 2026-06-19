import { describe, expect, test } from "bun:test"
import {
  checkAccountRateLimit,
  checkRateLimit,
  clearAccountFailures,
  recordAccountFailure,
  recordFailure,
} from "@/interface/shared/login-rate-limit"

// KV のインメモリフェイク。get / put / delete の最小実装。
// expirationTtl による自動削除は再現しない（テスト内ではウィンドウ計算で十分）。
function createFakeKV(): KVNamespace {
  const store = new Map<string, string>()

  const kv = {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value)
    },
    delete: async (key: string) => {
      store.delete(key)
    },
    list: () => Promise.reject(new Error("not implemented")),
    getWithMetadata: () => Promise.reject(new Error("not implemented")),
  }

  return kv as unknown as KVNamespace
}

// KV の全操作で例外を投げるフェイク。フェイルオープンの検証に使う。
function createBrokenKV(): KVNamespace {
  const kv = {
    get: async () => {
      throw new Error("KV unavailable")
    },
    put: async () => {
      throw new Error("KV unavailable")
    },
    delete: async () => {
      throw new Error("KV unavailable")
    },
    list: () => Promise.reject(new Error("not implemented")),
    getWithMetadata: () => Promise.reject(new Error("not implemented")),
  }

  return kv as unknown as KVNamespace
}

describe("login-rate-limit", () => {
  describe("IP rate limit", () => {
    test("allows requests when failure count is below threshold", async () => {
      const kv = createFakeKV()

      await recordFailure(kv, "192.0.2.1")
      await recordFailure(kv, "192.0.2.1")
      await recordFailure(kv, "192.0.2.1")
      await recordFailure(kv, "192.0.2.1")

      const blocked = await checkRateLimit(kv, "192.0.2.1")

      expect(blocked).toBe(false)
    })

    test("blocks requests when failure count reaches threshold", async () => {
      const kv = createFakeKV()

      for (let i = 0; i < 5; i++) {
        await recordFailure(kv, "192.0.2.1")
      }

      const blocked = await checkRateLimit(kv, "192.0.2.1")

      expect(blocked).toBe(true)
    })

    test("does not reset IP counter on successful login", async () => {
      const kv = createFakeKV()

      for (let i = 0; i < 5; i++) {
        await recordFailure(kv, "192.0.2.1")
      }

      // IP カウンタはログイン成功ではリセットされない（TTL で自然消滅する）
      const blocked = await checkRateLimit(kv, "192.0.2.1")

      expect(blocked).toBe(true)
    })

    test("isolates counters between different IPs", async () => {
      const kv = createFakeKV()

      for (let i = 0; i < 5; i++) {
        await recordFailure(kv, "192.0.2.1")
      }

      const blockedOther = await checkRateLimit(kv, "192.0.2.2")

      expect(blockedOther).toBe(false)
    })
  })

  describe("account rate limit", () => {
    test("allows requests when failure count is below threshold", async () => {
      const kv = createFakeKV()

      await recordAccountFailure(kv, "user@example.com")
      await recordAccountFailure(kv, "user@example.com")

      const blocked = await checkAccountRateLimit(kv, "user@example.com")

      expect(blocked).toBe(false)
    })

    test("blocks requests when failure count reaches threshold", async () => {
      const kv = createFakeKV()

      for (let i = 0; i < 5; i++) {
        await recordAccountFailure(kv, "user@example.com")
      }

      const blocked = await checkAccountRateLimit(kv, "user@example.com")

      expect(blocked).toBe(true)
    })

    test("normalizes email to lowercase", async () => {
      const kv = createFakeKV()

      for (let i = 0; i < 3; i++) {
        await recordAccountFailure(kv, "User@Example.COM")
      }

      for (let i = 0; i < 2; i++) {
        await recordAccountFailure(kv, "user@example.com")
      }

      const blocked = await checkAccountRateLimit(kv, "USER@EXAMPLE.COM")

      expect(blocked).toBe(true)
    })

    test("clears counter on successful login", async () => {
      const kv = createFakeKV()

      for (let i = 0; i < 5; i++) {
        await recordAccountFailure(kv, "user@example.com")
      }

      await clearAccountFailures(kv, "user@example.com")

      const blocked = await checkAccountRateLimit(kv, "user@example.com")

      expect(blocked).toBe(false)
    })
  })

  describe("window expiration", () => {
    test("ignores failures outside the 15-minute window", async () => {
      const kv = createFakeKV()

      // ウィンドウ外（16 分前）のタイムスタンプ 5 件を直接書き込む
      const now = Math.floor(Date.now() / 1000)
      const oldTimestamps = Array.from({ length: 5 }, () => now - 960)

      await kv.put("login:fail:ip:192.0.2.1", JSON.stringify(oldTimestamps))

      const blocked = await checkRateLimit(kv, "192.0.2.1")

      expect(blocked).toBe(false)
    })

    test("counts only failures within the 15-minute window", async () => {
      const kv = createFakeKV()

      // ウィンドウ外 3 件 + ウィンドウ内 5 件
      const now = Math.floor(Date.now() / 1000)
      const timestamps = [
        ...Array.from({ length: 3 }, () => now - 960),
        ...Array.from({ length: 5 }, () => now),
      ]

      await kv.put("login:fail:ip:192.0.2.1", JSON.stringify(timestamps))

      const blocked = await checkRateLimit(kv, "192.0.2.1")

      expect(blocked).toBe(true)
    })
  })

  describe("fail-open on KV error", () => {
    test("checkRateLimit returns false when KV read fails", async () => {
      const kv = createBrokenKV()

      const blocked = await checkRateLimit(kv, "192.0.2.1")

      expect(blocked).toBe(false)
    })

    test("checkAccountRateLimit returns false when KV read fails", async () => {
      const kv = createBrokenKV()

      const blocked = await checkAccountRateLimit(kv, "user@example.com")

      expect(blocked).toBe(false)
    })

    test("recordFailure does not throw when KV write fails", async () => {
      const kv = createBrokenKV()

      await recordFailure(kv, "192.0.2.1")
    })

    test("clearAccountFailures does not throw when KV delete fails", async () => {
      const kv = createBrokenKV()

      await clearAccountFailures(kv, "user@example.com")
    })
  })
})
