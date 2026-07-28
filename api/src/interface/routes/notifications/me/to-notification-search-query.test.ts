import { describe, expect, test } from "bun:test"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
} from "@/interface/utils/to-bounded-int"
import { toNotificationSearchQuery } from "@/interface/routes/notifications/me/to-notification-search-query"

describe("toNotificationSearchQuery", () => {
  describe("limit", () => {
    test("falls back to DEFAULT_LIST_LIMIT when unspecified", () => {
      const result = toNotificationSearchQuery({
        isRead: undefined,
        limit: undefined,
        offset: undefined,
      })
      expect(result.limit).toBe(DEFAULT_LIST_LIMIT)
    })

    test("parses a valid limit", () => {
      const result = toNotificationSearchQuery({
        isRead: undefined,
        limit: "10",
        offset: undefined,
      })
      expect(result.limit).toBe(10)
    })

    test("clamps limit above MAX_LIST_LIMIT", () => {
      const result = toNotificationSearchQuery({
        isRead: undefined,
        limit: "9999",
        offset: undefined,
      })
      expect(result.limit).toBe(MAX_LIST_LIMIT)
    })

    test("falls back on mixed string limit (does not greedily parse leading digits)", () => {
      const result = toNotificationSearchQuery({
        isRead: undefined,
        limit: "50abc",
        offset: undefined,
      })
      expect(result.limit).toBe(DEFAULT_LIST_LIMIT)
    })

    test("falls back on non-positive limit (0 is below min:1)", () => {
      const result = toNotificationSearchQuery({ isRead: undefined, limit: "0", offset: undefined })
      expect(result.limit).toBe(DEFAULT_LIST_LIMIT)
    })
  })

  describe("offset", () => {
    test("falls back to 0 when unspecified", () => {
      const result = toNotificationSearchQuery({
        isRead: undefined,
        limit: undefined,
        offset: undefined,
      })
      expect(result.offset).toBe(0)
    })

    test("parses a valid offset", () => {
      const result = toNotificationSearchQuery({
        isRead: undefined,
        limit: undefined,
        offset: "100",
      })
      expect(result.offset).toBe(100)
    })

    test("clamps offset exceeding the SQLite 32-bit max to MAX_LIST_OFFSET", () => {
      const result = toNotificationSearchQuery({
        isRead: undefined,
        limit: undefined,
        offset: "9999999999999",
      })
      expect(result.offset).toBe(MAX_LIST_OFFSET)
    })

    test("falls back on mixed string offset", () => {
      const result = toNotificationSearchQuery({
        isRead: undefined,
        limit: undefined,
        offset: "100abc",
      })
      expect(result.offset).toBe(0)
    })

    test("falls back on negative offset", () => {
      const result = toNotificationSearchQuery({
        isRead: undefined,
        limit: undefined,
        offset: "-1",
      })
      expect(result.offset).toBe(0)
    })
  })

  describe("isRead", () => {
    test("parses true", () => {
      const result = toNotificationSearchQuery({
        isRead: "true",
        limit: undefined,
        offset: undefined,
      })
      expect(result.isRead).toBe(true)
    })

    test("parses false", () => {
      const result = toNotificationSearchQuery({
        isRead: "false",
        limit: undefined,
        offset: undefined,
      })
      expect(result.isRead).toBe(false)
    })

    test("returns null for unrecognized values", () => {
      const result = toNotificationSearchQuery({
        isRead: "yes",
        limit: undefined,
        offset: undefined,
      })
      expect(result.isRead).toBe(null)
    })

    test("returns null when unspecified", () => {
      const result = toNotificationSearchQuery({
        isRead: undefined,
        limit: undefined,
        offset: undefined,
      })
      expect(result.isRead).toBe(null)
    })
  })
})
