import { createTestToken } from "@/api/test/support/create-test-token"
import {
  createLifecycleRouteDb,
  lifecycleRouteJwtSecret,
  readOrganizationRevision,
} from "@/api/test/support/lifecycle-route-fixture"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { zAppCompanyOrganizationSnapshot } from "@/lib/app-schemas"
import { describe, expect, test } from "bun:test"

function token(employeeId: number): Promise<string> {
  return createTestToken(lifecycleRouteJwtSecret, { employeeId })
}

describe("GET /company/v1/organization-snapshots", () => {
  test("returns active OrgUnits, Assignments and Responsibilities from one revision", async () => {
    const db = await createLifecycleRouteDb()
    const organizationRevision = await readOrganizationRevision(db)
    const response = await requestWithContext({
      db,
      jwtSecret: lifecycleRouteJwtSecret,
      path: "/company/v1/organization-snapshots?as_of=2026-01-01",
      token: await token(1),
    })

    expect(response.status).toBe(200)
    const body = zAppCompanyOrganizationSnapshot.parse(await response.json())
    expect(body).toMatchObject({
      as_of: "2026-01-01",
      organization_revision: organizationRevision,
    })
    expect(body.organization_units).toContainEqual(
      expect.objectContaining({
        organization_unit_id: "company:root",
        kind: "COMPANY",
        parent_organization_unit_id: null,
      }),
    )
    expect(body.assignments).toContainEqual(
      expect.objectContaining({
        employee_id: "employee:5",
        organization_unit_id: "department:D003",
      }),
    )
    expect(body.responsibilities).toContainEqual(
      expect.objectContaining({
        employee_id: "employee:1",
        responsibility_type: "PEOPLE_OPERATIONS",
      }),
    )
  })

  test("does not expose the whole organization to a member", async () => {
    const response = await requestWithContext({
      db: await createLifecycleRouteDb(),
      jwtSecret: lifecycleRouteJwtSecret,
      path: "/company/v1/organization-snapshots?as_of=2026-01-01",
      token: await token(5),
    })

    expect(response.status).toBe(403)
  })
})
