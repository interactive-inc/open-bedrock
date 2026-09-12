import { expect, test } from "bun:test"
import { Hono } from "hono"
import { z } from "zod"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import * as records from "@/contexts/company/interface/routes/company.definition-resource-adoptions.$commandId"
import * as adoptions from "@/contexts/company/interface/routes/company.definition-resource-adoptions"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { createCompanyAssignmentResourceTestContext } from "@/contexts/company/test/company-assignment-resource.test-support"

test("定義の移行APIは確認条件・会社範囲・権限を強制し、公開履歴と証跡を一度だけ確定する", async () => {
  const f = await createCompanyAssignmentResourceTestContext()
  await f.database
    .prepare(`INSERT INTO company_grade_definitions(id, code, name, rank, description, created_at)
    VALUES (991, 'G1', 'Current title', 1, NULL, '2020-01-01T00:00:00Z')`)
    .run()
  const administrator = CompanyActorValue.restore({
    ...f.creator,
    employeeId: null,
    organizationIds: ["organization:default"],
    capabilities: ["company:admin"],
  })
  let actor: CompanyActorValue | undefined = administrator
  const app = new Hono<CompanyHttpEnvironment>()
  app.use("*", async (context, next) => {
    if (actor !== undefined) context.set("companyActor", actor)
    context.set("companyClock", () => new Date("2030-06-01T12:00:00Z"))
    context.set("database", f.context.var.database)
    context.set("auditContext", f.context.var.auditContext)
    await next()
  })
  app.onError((error, context) => {
    if (!(error instanceof CompanyHTTPException)) throw error
    return context.json({ code: error.code }, error.status)
  })
  app
    .get("/adoptions", ...adoptions.GET)
    .post("/adoptions", ...adoptions.POST)
    .get("/adoptions/:commandId", ...records.GET)
  const env = { ...f.context.env, COMPANY_TIME_ZONE: "UTC" }
  const preview = await app.request("/adoptions?type=grade&definition_id=991", {}, env)
  expect(preview.status).toBe(200)
  const confirmation = z
    .object({ expectedRevision: z.number(), snapshotDigest: z.string(), observedOn: z.string() })
    .parse(await preview.json())
  const input = {
    ...confirmation,
    type: "grade",
    definitionId: 991,
    resourceId: "grade:adopted",
    reason: "Confirm grade",
  }
  const post = (body: unknown = input) =>
    app.request(
      "/adoptions",
      {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": "adoption:http" },
        body: JSON.stringify(body),
      },
      env,
    )
  expect((await post({ ...input, observedOn: "2020-01-01" })).status).toBe(409)
  expect((await post({ ...input, actorAccountId: "forged:account" })).status).toBe(400)
  expect(await f.companyRevision()).toBe(confirmation.expectedRevision)
  expect((await post()).status).toBe(201)
  expect((await post()).status).toBe(200)
  for (const denied of [
    undefined,
    CompanyActorValue.restore({
      accountId: administrator.accountId,
      employeeId: null,
      organizationIds: ["organization:default"],
      capabilities: ["company:read"],
    }),
    CompanyActorValue.restore({
      accountId: administrator.accountId,
      employeeId: null,
      organizationIds: ["other:organization"],
      capabilities: ["company:admin"],
    }),
  ]) {
    actor = denied
    const expected = denied === undefined ? 401 : 403
    expect((await app.request("/adoptions?type=grade&definition_id=991", {}, env)).status).toBe(
      expected,
    )
    expect((await post()).status).toBe(expected)
    expect((await app.request("/adoptions/adoption:http", {}, env)).status).toBe(expected)
  }
  actor = administrator
  await f.database.exec("DROP TABLE company_grade_definitions")
  const evidence = await app.request("/adoptions/adoption:http", {}, env)
  expect(evidence.status).toBe(200)
  expect(await evidence.json()).toMatchObject({
    observedOn: "2030-06-01",
    actorAccountId: administrator.accountId,
    source: { definition: { name: "Current title", createdAt: "2020-01-01T00:00:00Z" } },
  })
  expect((await post()).status).toBe(200)
  expect(await f.companyRevision()).toBe(confirmation.expectedRevision + 1)
  expect(
    await f.database
      .prepare("SELECT count(*) AS total FROM company_definition_resource_adoptions")
      .first<number>("total"),
  ).toBe(1)
})
