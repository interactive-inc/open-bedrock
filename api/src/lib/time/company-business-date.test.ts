import {
  CompanyTimeZoneError,
  InvalidBusinessDateError,
  containsBusinessDate,
  nextCalendarDate,
  resolveCompanyBusinessDate,
} from "@/lib/time/company-business-date"
import { describe, expect, test } from "bun:test"

describe("resolveCompanyBusinessDate", () => {
  test("uses the configured company time zone at the Tokyo date boundary", () => {
    expect(
      resolveCompanyBusinessDate({
        now: "2026-03-15T14:59:59.000Z",
        timeZone: "Asia/Tokyo",
      }),
    ).toBe("2026-03-15")

    expect(
      resolveCompanyBusinessDate({
        now: "2026-03-15T15:00:00.000Z",
        timeZone: "Asia/Tokyo",
      }),
    ).toBe("2026-03-16")
  })

  test("uses an IANA time zone across a daylight-saving transition", () => {
    expect(
      resolveCompanyBusinessDate({
        now: "2026-03-08T04:30:00.000Z",
        timeZone: "America/New_York",
      }),
    ).toBe("2026-03-07")

    expect(
      resolveCompanyBusinessDate({
        now: "2026-03-08T05:30:00.000Z",
        timeZone: "America/New_York",
      }),
    ).toBe("2026-03-08")
  })

  test("fails closed when the time zone is missing or unknown", () => {
    expect(
      resolveCompanyBusinessDate({ now: "2026-03-15T00:00:00.000Z", timeZone: undefined }),
    ).toBeInstanceOf(CompanyTimeZoneError)

    expect(
      resolveCompanyBusinessDate({ now: "2026-03-15T00:00:00.000Z", timeZone: "Mars/Base" }),
    ).toBeInstanceOf(CompanyTimeZoneError)
  })

  test("fails closed when now is not a valid instant", () => {
    expect(
      resolveCompanyBusinessDate({ now: "not-an-instant", timeZone: "Asia/Tokyo" }),
    ).toBeInstanceOf(CompanyTimeZoneError)
  })
})

describe("nextCalendarDate", () => {
  test("advances over month, leap-day, and year boundaries", () => {
    expect(nextCalendarDate("2026-01-31")).toBe("2026-02-01")
    expect(nextCalendarDate("2028-02-28")).toBe("2028-02-29")
    expect(nextCalendarDate("2025-12-31")).toBe("2026-01-01")
  })

  test("rejects non-canonical and impossible dates", () => {
    expect(nextCalendarDate("2026-1-1")).toBeInstanceOf(InvalidBusinessDateError)
    expect(nextCalendarDate("2026-02-30")).toBeInstanceOf(InvalidBusinessDateError)
  })
})

describe("containsBusinessDate", () => {
  test("uses a half-open interval", () => {
    expect(
      containsBusinessDate({
        startsOn: "2026-04-01",
        endsOn: "2026-05-01",
        businessDate: "2026-04-01",
      }),
    ).toBe(true)

    expect(
      containsBusinessDate({
        startsOn: "2026-04-01",
        endsOn: "2026-05-01",
        businessDate: "2026-04-30",
      }),
    ).toBe(true)

    expect(
      containsBusinessDate({
        startsOn: "2026-04-01",
        endsOn: "2026-05-01",
        businessDate: "2026-05-01",
      }),
    ).toBe(false)
  })

  test("supports an open-ended interval and rejects invalid dates", () => {
    expect(
      containsBusinessDate({
        startsOn: "2026-04-01",
        endsOn: null,
        businessDate: "2099-12-31",
      }),
    ).toBe(true)

    expect(
      containsBusinessDate({
        startsOn: "2026-02-30",
        endsOn: null,
        businessDate: "2026-03-01",
      }),
    ).toBe(false)
  })
})
