import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { z } from "zod"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { createTestToken } from "@tests/api/support/create-test-token"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { type LocalD1Pool, startLocalD1Pool } from "@tests/d1/support/start-local-d1-pool"
import { execSql } from "@tests/d1/support/exec-sql"

let pool: LocalD1Pool

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  pool = await startLocalD1Pool(2)
})

afterAll(async () => {
  await pool.dispose()
})

test.each(["grade", "position"] as const)(
  "%s管理だけのSystem roleは対象定義に限定され、人事履歴へ権限を広げない",
  async (type) => {
    const db = await pool.next()
    await initializeStandardCompanyTestState(db)
    await db.prepare("DELETE FROM system_role_bindings WHERE account_id = '1'").run()
    await execSql(
      db,
      `INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at)
      VALUES ('2361a5f0-b0e2-4c85-8029-2476ac5c16f1', 'custom:definition-only', 'custom', 'Definition manager', 0, 0);
      INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
      VALUES ('2361a5f0-b0e2-4c85-8029-2476ac5c16f1', '1', '2361a5f0-b0e2-4c85-8029-2476ac5c16f1', NULL, NULL, 0, NULL);`,
    )
    await db
      .prepare(
        "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('2361a5f0-b0e2-4c85-8029-2476ac5c16f1', ?)",
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
      .prepare("SELECT * FROM company_personnel_annotations ORDER BY id")
      .all()
    const event = await requestWithContext({
      ...common,
      method: "POST",
      path: "/company/employee-events",
      body: { employee_code: "E001", kind: "join", effective_date: "2026-01-01" },
    })
    expect(event.status).toBe(404)
    // 実D1の結果はmetaに実行時間を含むため、行だけを比べる。
    expect(
      (await db.prepare("SELECT * FROM company_personnel_annotations ORDER BY id").all()).results,
    ).toEqual(originalEvents.results)
    await db
      .prepare(
        "DELETE FROM system_iam_role_permissions WHERE role_id = '2361a5f0-b0e2-4c85-8029-2476ac5c16f1'",
      )
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
