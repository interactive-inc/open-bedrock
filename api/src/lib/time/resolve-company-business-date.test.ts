import { CompanyTimeZoneError } from "@/lib/time/company-time-zone-error"
import { resolveCompanyBusinessDate } from "@/lib/time/resolve-company-business-date"
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
