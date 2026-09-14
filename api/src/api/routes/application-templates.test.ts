import { expect, test } from "bun:test"
import { createTestContext } from "@tests/api/support/create-test-context"
import { createTestToken } from "@tests/api/support/create-test-token"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"

const prefixes = ["/application-templates", "/company/application-templates"]
const secret = "template-route-test-signing-secret"

test.each(prefixes)("%s は未認証の全操作を拒否する", async (prefix) => {
  const fixture = await createTestContext({ withCompanyOrganization: true })
  const operations = [
    { method: "GET", suffix: "" },
    { method: "POST", suffix: "" },
    { method: "GET", suffix: "/demo" },
    { method: "PUT", suffix: "/demo" },
    { method: "DELETE", suffix: "/demo" },
    { method: "GET", suffix: "/demo/workflow" },
    { method: "PUT", suffix: "/demo/workflow" },
  ]
  for (const operation of operations) {
    const response = await requestWithContext({
      db: fixture.db,
      jwtSecret: secret,
      token: null,
      path: prefix + operation.suffix,
      method: operation.method,
    })
    expect(response.status).toBe(401)
  }
})

test("中立URLと互換URLは同じテンプレート一覧を返す", async () => {
  const fixture = await createTestContext({ withCompanyOrganization: true })
  const token = await createTestToken(secret, { employeeId: restoreWorkforceId("employee", "1") })
  const current = await requestWithContext({
    db: fixture.db,
    jwtSecret: secret,
    token,
    path: prefixes[0]!,
  })
  const legacy = await requestWithContext({
    db: fixture.db,
    jwtSecret: secret,
    token,
    path: prefixes[1]!,
  })
  expect(current.status).toBe(200)
  expect(legacy.status).toBe(200)
  expect(await current.json()).toEqual(await legacy.json())
})

test.each(prefixes)("%s は管理権限のない従業員の操作を拒否する", async (prefix) => {
  const fixture = await createTestContext({ withCompanyOrganization: true })
  const token = await createTestToken(secret, { employeeId: restoreWorkforceId("employee", "3") })
  for (const operation of [
    { method: "DELETE", suffix: "/demo" },
    { method: "GET", suffix: "/demo/workflow" },
  ]) {
    const response = await requestWithContext({
      db: fixture.db,
      jwtSecret: secret,
      token,
      path: prefix + operation.suffix,
      method: operation.method,
    })
    expect(response.status).toBe(403)
  }
})
