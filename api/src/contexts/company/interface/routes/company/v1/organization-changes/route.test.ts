import { createTestToken } from "@/api/test/support/create-test-token"
import {
  createLifecycleRouteDb,
  lifecycleRouteJwtSecret,
  readOrganizationRevision,
} from "@/api/test/support/lifecycle-route-fixture"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { describe, expect, test } from "bun:test"

function token(employeeId: number): Promise<string> {
  return createTestToken(lifecycleRouteJwtSecret, { employeeId })
}

function body(expectedRevision: number) {
  return {
    operation_id: "operation:company-api:responsibility-5",
    expected_revision: expectedRevision,
    as_of: "2026-01-01",
    recorded_at: "2026-01-02T00:00:00.000Z",
    reason: "Assign security review responsibility",
    evidence_references: [
      { context: "system", kind: "decision", id: "decision:security-review", version: "1" },
    ],
    organization_units: [],
    unit_periods: [],
    assignments: [],
    responsibilities: [
      {
        period_id: "responsibility:company-api:5",
        revision: 1,
        employment_id: "employment:employment-5",
        employee_id: "employee:5",
        organization_unit_id: "department:D003",
        responsibility_type: "SECURITY_REVIEW",
        starts_on: "2026-01-01",
        ends_on: null,
        is_void: false,
      },
    ],
  }
}

async function request(db: D1Database, requestBody: ReturnType<typeof body>) {
  return requestWithContext({
    db,
    jwtSecret: lifecycleRouteJwtSecret,
    path: "/company/v1/organization-changes",
    method: "POST",
    body: requestBody,
    headers: { "Idempotency-Key": requestBody.operation_id },
    token: await token(1),
  })
}

describe("POST /company/v1/organization-changes", () => {
  test("atomically applies and idempotently replays the same command", async () => {
    const db = await createLifecycleRouteDb()
    const organizationRevision = await readOrganizationRevision(db)
    const requestBody = body(organizationRevision)
    const created = await request(db, requestBody)
    const replayed = await request(db, requestBody)

    expect(created.status).toBe(201)
    expect(await created.json()).toEqual({
      operation_id: requestBody.operation_id,
      organization_revision: organizationRevision + 1,
      replayed: false,
    })
    expect(replayed.status).toBe(200)
    expect(await replayed.json()).toEqual({
      operation_id: requestBody.operation_id,
      organization_revision: organizationRevision + 1,
      replayed: true,
    })
    expect(
      await db
        .prepare(
          `SELECT actor_account_id, reason, evidence_references_json
             FROM organization_change_operations WHERE id = ?1`,
        )
        .bind(requestBody.operation_id)
        .first<{
          actor_account_id: string
          reason: string
          evidence_references_json: string
        }>(),
    ).toEqual({
      actor_account_id: "1",
      reason: requestBody.reason,
      evidence_references_json: JSON.stringify(requestBody.evidence_references),
    })
  })

  test("rejects a stale revision and a reused operation ID with different content", async () => {
    const db = await createLifecycleRouteDb()
    const organizationRevision = await readOrganizationRevision(db)
    const requestBody = body(organizationRevision)
    expect((await request(db, requestBody)).status).toBe(201)

    const stale = await request(db, {
      ...requestBody,
      operation_id: "operation:company-api:stale",
      expected_revision: organizationRevision,
    })
    const reused = await request(db, {
      ...requestBody,
      responsibilities: [
        {
          ...requestBody.responsibilities[0]!,
          responsibility_type: "PRIVACY_REVIEW",
        },
      ],
    })

    expect(stale.status).toBe(409)
    expect(await stale.json()).toMatchObject({ code: "organization_revision_conflict" })
    expect(reused.status).toBe(409)
    expect(await reused.json()).toMatchObject({ code: "organization_operation_conflict" })
  })

  test("requires both technical permission and Company responsibility", async () => {
    const db = await createLifecycleRouteDb()
    const organizationRevision = await readOrganizationRevision(db)
    const response = await requestWithContext({
      db,
      jwtSecret: lifecycleRouteJwtSecret,
      path: "/company/v1/organization-changes",
      method: "POST",
      body: body(organizationRevision),
      headers: { "Idempotency-Key": "operation:company-api:responsibility-5" },
      token: await token(5),
    })

    expect(response.status).toBe(403)
  })
})
