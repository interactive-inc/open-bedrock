import {
  ReadCompanyReadiness,
  type CompanyReadinessPortResult,
} from "@/contexts/company/application/workforce/read-company-readiness"
import { restoreCalendarDate } from "@/contexts/company/domain/workforce/restore-calendar-date"
import { describe, expect, test } from "bun:test"

function service(result: CompanyReadinessPortResult): ReadCompanyReadiness {
  return new ReadCompanyReadiness({ readStatus: async () => result })
}

describe("ReadCompanyReadiness", () => {
  test("accepts only a verified baseline with the configured Company time zone", async () => {
    const target = service({
      ok: true,
      status: "verified",
      baselineOn: "2025-01-01",
      companyTimeZone: "Asia/Tokyo",
    })

    expect(await target.execute("Asia/Tokyo")).toEqual({
      kind: "ready",
      baselineOn: restoreCalendarDate("2025-01-01"),
    })
    expect(await target.execute("UTC")).toEqual(expect.objectContaining({ kind: "unavailable" }))
  })

  test("distinguishes incomplete migration from corrupt verified metadata", async () => {
    expect(
      await service({
        ok: true,
        status: "pending",
        baselineOn: null,
        companyTimeZone: null,
      }).execute("Asia/Tokyo"),
    ).toEqual({ kind: "incomplete", status: "pending" })
    expect(
      await service({
        ok: true,
        status: "verified",
        baselineOn: "not-a-date",
        companyTimeZone: "Asia/Tokyo",
      }).execute("Asia/Tokyo"),
    ).toEqual(expect.objectContaining({ kind: "unavailable" }))
  })
})
