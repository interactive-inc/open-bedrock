import { createTestContext } from "@/api/test/support/create-test-context"
import type { OrganizationChangeSet } from "@/contexts/company/application/workforce/apply-organization-change"
import { restoreCalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import { restoreWorkforceId } from "@/contexts/company/domain/workforce/workforce-id"
import { OrganizationChangeRepository } from "@/contexts/company/infrastructure/workforce/organization-change.repository"
import { describe, expect, test } from "bun:test"

function change(
  operation = "action:create-team",
  expectedRevision = 1,
  parent = "company:root",
): OrganizationChangeSet {
  const operationId = restoreWorkforceId("personnel_action", operation)
  const organizationUnitId = restoreWorkforceId("organization_unit", "team:platform")
  return {
    operationId,
    expectedRevision,
    asOf: restoreCalendarDate("2026-01-01"),
    recordedAt: 10,
    organizationUnits: [{ id: organizationUnitId, createdAt: 10 }],
    unitPeriods: [
      {
        periodId: restoreWorkforceId("period", "team:platform:period"),
        revision: 1,
        organizationUnitId,
        code: "PLATFORM",
        officialName: "Platform Team",
        kind: "TEAM",
        parentOrganizationUnitId:
          parent === "" ? null : restoreWorkforceId("organization_unit", parent),
        startsOn: restoreCalendarDate("2026-01-01"),
        endsOn: null,
        isVoid: false,
        recordedByActionId: operationId,
        recordedAt: 10,
      },
    ],
    assignments: [],
    responsibilities: [],
  }
}

describe("OrganizationChangeRepository", () => {
  test("opaque OrgUnit変更を一回のatomic batchで追記して完了する", async () => {
    const { context, db } = createTestContext()
    const repository = new OrganizationChangeRepository(context.var.database)
    const input = change()

    expect(await repository.append(input)).toEqual({ ok: true, revision: 2 })
    expect(
      await db
        .prepare("SELECT id FROM organization_units WHERE id = 'team:platform'")
        .first<string>("id"),
    ).toBe("team:platform")
    expect(
      await db
        .prepare(
          `SELECT expected_revision, applied_count, resulting_revision, status
             FROM organization_change_operations WHERE id = ?1`,
        )
        .bind(input.operationId)
        .first<{
          expected_revision: number
          applied_count: number
          resulting_revision: number
          status: string
        }>(),
    ).toEqual({
      expected_revision: 1,
      applied_count: 1,
      resulting_revision: 2,
      status: "COMPLETED",
    })
    expect(await repository.append(input)).toEqual({
      ok: false,
      kind: "conflict",
      actualRevision: 2,
    })
  })

  test("親を欠く非root変更はoperationとidentityを残さずrollbackする", async () => {
    const { context, db } = createTestContext()
    const result = await new OrganizationChangeRepository(context.var.database).append(
      change("action:orphan", 1, ""),
    )

    expect(result).toEqual(expect.objectContaining({ ok: false, kind: "unavailable" }))
    expect(
      await db
        .prepare("SELECT id FROM organization_change_operations WHERE id = 'action:orphan'")
        .first(),
    ).toBeNull()
    expect(
      await db.prepare("SELECT id FROM organization_units WHERE id = 'team:platform'").first(),
    ).toBeNull()
    expect(
      await db
        .prepare("SELECT revision FROM organization_lifecycle_states WHERE id = 1")
        .first<number>("revision"),
    ).toBe(1)
  })
})
