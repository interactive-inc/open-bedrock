import { describe, expect, test } from "bun:test"
import { LoginRateLimiter } from "@/contexts/company/interface/utils/login-rate-limiter"

/**
 * KV のインメモリフェイク。get / put / delete の最小実装。
 * expirationTtl による自動削除は再現しない（テスト内ではウィンドウ計算で十分）。
 */
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

/** KV の全操作で例外を投げるフェイク。フェイルオープンの検証に使う。 */
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

describe("LoginRateLimiter", () => {
  describe("IP rate limit", () => {
    test("allows requests when failure count is below threshold", async () => {
      const limiter = new LoginRateLimiter(createFakeKV())

      await limiter.recordIpFailure("192.0.2.1")
      await limiter.recordIpFailure("192.0.2.1")
      await limiter.recordIpFailure("192.0.2.1")
      await limiter.recordIpFailure("192.0.2.1")

      const blocked = await limiter.isIpLimited("192.0.2.1")

      expect(blocked).toBe(false)
    })

    test("blocks requests when failure count reaches threshold", async () => {
      const limiter = new LoginRateLimiter(createFakeKV())

      for (let i = 0; i < 5; i++) {
        await limiter.recordIpFailure("192.0.2.1")
      }

      const blocked = await limiter.isIpLimited("192.0.2.1")

      expect(blocked).toBe(true)
    })

    test("does not reset IP counter on successful login", async () => {
      const limiter = new LoginRateLimiter(createFakeKV())

      for (let i = 0; i < 5; i++) {
        await limiter.recordIpFailure("192.0.2.1")
      }

      // IP カウンタはログイン成功ではリセットされない（TTL で自然消滅する）
      const blocked = await limiter.isIpLimited("192.0.2.1")

      expect(blocked).toBe(true)
    })

    test("isolates counters between different IPs", async () => {
      const limiter = new LoginRateLimiter(createFakeKV())

      for (let i = 0; i < 5; i++) {
        await limiter.recordIpFailure("192.0.2.1")
      }

      const blockedOther = await limiter.isIpLimited("192.0.2.2")

      expect(blockedOther).toBe(false)
    })
  })

  describe("account rate limit", () => {
    test("allows requests when failure count is below threshold", async () => {
      const limiter = new LoginRateLimiter(createFakeKV())

      await limiter.recordAccountFailure("user@example.com")
      await limiter.recordAccountFailure("user@example.com")

      const blocked = await limiter.isAccountLimited("user@example.com")

      expect(blocked).toBe(false)
    })

    test("blocks requests when failure count reaches threshold", async () => {
      const limiter = new LoginRateLimiter(createFakeKV())

      for (let i = 0; i < 5; i++) {
        await limiter.recordAccountFailure("user@example.com")
      }

      const blocked = await limiter.isAccountLimited("user@example.com")

      expect(blocked).toBe(true)
    })

    test("normalizes email to lowercase", async () => {
      const limiter = new LoginRateLimiter(createFakeKV())

      for (let i = 0; i < 3; i++) {
        await limiter.recordAccountFailure("User@Example.COM")
      }

      for (let i = 0; i < 2; i++) {
        await limiter.recordAccountFailure("user@example.com")
      }

      const blocked = await limiter.isAccountLimited("USER@EXAMPLE.COM")

      expect(blocked).toBe(true)
    })

    test("clears counter on successful login", async () => {
      const limiter = new LoginRateLimiter(createFakeKV())

      for (let i = 0; i < 5; i++) {
        await limiter.recordAccountFailure("user@example.com")
      }

      await limiter.clearAccountFailures("user@example.com")

      const blocked = await limiter.isAccountLimited("user@example.com")

      expect(blocked).toBe(false)
    })
  })

  describe("window expiration", () => {
    test("ignores failures outside the 15-minute window", async () => {
      const kv = createFakeKV()
      const limiter = new LoginRateLimiter(kv)

      // ウィンドウ外（16 分前）のタイムスタンプ 5 件を直接書き込む
      const now = Math.floor(Date.now() / 1000)
      const oldTimestamps = Array.from({ length: 5 }, () => now - 960)

      await kv.put("login:fail:ip:192.0.2.1", JSON.stringify(oldTimestamps))

      const blocked = await limiter.isIpLimited("192.0.2.1")

      expect(blocked).toBe(false)
    })

    test("counts only failures within the 15-minute window", async () => {
      const kv = createFakeKV()
      const limiter = new LoginRateLimiter(kv)

      // ウィンドウ外 3 件 + ウィンドウ内 5 件
      const now = Math.floor(Date.now() / 1000)
      const timestamps = [
        ...Array.from({ length: 3 }, () => now - 960),
        ...Array.from({ length: 5 }, () => now),
      ]

      await kv.put("login:fail:ip:192.0.2.1", JSON.stringify(timestamps))

      const blocked = await limiter.isIpLimited("192.0.2.1")

      expect(blocked).toBe(true)
    })
  })

  describe("fail-open on KV error", () => {
    test("checkRateLimit returns false when KV read fails", async () => {
      const limiter = new LoginRateLimiter(createBrokenKV())

      const blocked = await limiter.isIpLimited("192.0.2.1")

      expect(blocked).toBe(false)
    })

    test("checkAccountRateLimit returns false when KV read fails", async () => {
      const limiter = new LoginRateLimiter(createBrokenKV())

      const blocked = await limiter.isAccountLimited("user@example.com")

      expect(blocked).toBe(false)
    })

    test("recordFailure does not throw when KV write fails", async () => {
      const limiter = new LoginRateLimiter(createBrokenKV())

      await limiter.recordIpFailure("192.0.2.1")
    })

    test("clearAccountFailures does not throw when KV delete fails", async () => {
      const limiter = new LoginRateLimiter(createBrokenKV())

      await limiter.clearAccountFailures("user@example.com")
    })
  })
})
