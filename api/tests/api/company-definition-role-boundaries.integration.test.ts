import { expect, test } from "bun:test"
import { z } from "zod"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"

test.each(["grade", "position"] as const)(
  "%s管理だけのSystem roleは対象定義に限定され、人事履歴へ権限を広げない",
  async (type) => {
    const db = createD1TestDatabase(loadSchema())
    await initializeStandardCompanyTestState(db)
    await db.prepare("DELETE FROM system_role_bindings WHERE account_id = '1'").run()
    await db.exec(`INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at)
      VALUES ('definition-only', 'custom:definition-only', 'custom', 'Definition manager', 0, 0);
      INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
      VALUES ('definition-only', '1', 'definition-only', NULL, NULL, 0, NULL);`)
    await db
      .prepare(
        "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('definition-only', ?)",
      )
      .bind(`${type}:manage`)
      .run()
    const jwtSecret = "definition-role-boundary-test-secret"
    const token = await createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(1) })
    const common = { db, jwtSecret, token }
    const headers = { "x-company-organization-id": "organization:default" }
    const snapshot = await requestWithContext({
      ...common,
      path: `/company/definitions?type=${type}`,
      headers,
    })
    expect(snapshot.status).toBe(200)
    const revision = z
      .object({ organizationRevision: z.number() })
      .parse(await snapshot.json()).organizationRevision
    const command = {
      reason: "Confirmed definition",
      resources: [
        {
          organizationId: "organization:default",
          type,
          id: `${type}:scoped`,
          revision: 1,
          state: "active",
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          attributes: { code: "SCOPED", officialName: "Scoped definition" },
        },
      ],
    }
    const writeHeaders = {
      ...headers,
      "if-match": String(revision),
      "idempotency-key": `scoped-${type}`,
    }
    for (const status of [201, 200]) {
      const saved = await requestWithContext({
        ...common,
        method: "POST",
        path: "/company/definitions",
        headers: writeHeaders,
        body: command,
      })
      expect(saved.status).toBe(status)
    }
    for (const path of [
      "/company/definitions",
      `/company/definitions?type=${type === "grade" ? "position" : "grade"}`,
      "/company/people",
    ]) {
      expect((await requestWithContext({ ...common, path, headers })).status).toBe(403)
    }
    const originalEvents = await db
      .prepare("SELECT * FROM company_employee_events ORDER BY id")
      .all()
    const event = await requestWithContext({
      ...common,
      method: "POST",
      path: "/company/employee-events",
      body: { employee_code: "E001", kind: "join", effective_date: "2026-01-01" },
    })
    expect(event.status).toBe(404)
    expect(await db.prepare("SELECT * FROM company_employee_events ORDER BY id").all()).toEqual(
      originalEvents,
    )
    await db
      .prepare("DELETE FROM system_iam_role_permissions WHERE role_id = 'definition-only'")
      .run()
    expect(
      (
        await requestWithContext({
          ...common,
          method: "POST",
          path: "/company/definitions",
          headers: writeHeaders,
          body: command,
        })
      ).status,
    ).toBe(403)
  },
)
