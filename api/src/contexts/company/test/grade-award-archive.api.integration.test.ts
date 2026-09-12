import { expect, test } from "bun:test"
import { Hono } from "hono"
import { z } from "zod"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import * as archives from "@/contexts/company/interface/routes/company.grade-award-archives"
import * as employeeArchives from "@/contexts/company/interface/routes/company.grade-award-archives.by-employee.$employeeId"
import * as records from "@/contexts/company/interface/routes/company.grade-award-archives.$commandId"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { createCompanyAssignmentResourceTestContext } from "@/contexts/company/test/company-assignment-resource.test-support"

test("原記録の保全APIは会社範囲と権限を強制し、主体の詐称・過去の補完を拒否する", async () => {
  const f = await createCompanyAssignmentResourceTestContext()
  const administrator = CompanyActorValue.restore({
    ...f.creator,
    employeeId: null,
    organizationIds: ["organization:default"],
    capabilities: ["company:admin"],
  })
  const state: { actor: CompanyActorValue | undefined } = { actor: administrator }
  const app = new Hono<CompanyHttpEnvironment>()
  app.use("*", async (context, next) => {
    if (state.actor !== undefined) context.set("companyActor", state.actor)
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
    .get("/archives", ...archives.GET)
    .post("/archives", ...archives.POST)
    .get("/archives/by-employee/:employeeId", ...employeeArchives.GET)
    .get("/archives/:commandId", ...records.GET)
  const env = { ...f.context.env, COMPANY_TIME_ZONE: "UTC" }
  const previewUrl = `/archives?employee_id=${encodeURIComponent(f.people[0]!.employeeId)}`
  const preview = await app.request(previewUrl, {}, env)
  expect(preview.status).toBe(200)
  const confirmation = z
    .object({ expectedRevision: z.number(), snapshotDigest: z.string(), observedOn: z.string() })
    .parse(await preview.json())
  const input = {
    ...confirmation,
    employeeId: f.people[0]!.employeeId,
    reason: "Preserve original records",
  }
  const post = (body: unknown = input) =>
    app.request(
      "/archives",
      {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": "archive:http" },
        body: JSON.stringify(body),
      },
      env,
    )
  for (const denied of [
    undefined,
    CompanyActorValue.restore({
      ...f.creator,
      employeeId: null,
      organizationIds: ["organization:default"],
      capabilities: ["company:write"],
    }),
    CompanyActorValue.restore({
      ...f.creator,
      employeeId: null,
      organizationIds: ["other:organization"],
      capabilities: ["company:admin"],
    }),
  ]) {
    state.actor = denied
    const expected = denied === undefined ? 401 : 403
    expect((await app.request(previewUrl, {}, env)).status).toBe(expected)
    expect((await post()).status).toBe(expected)
    expect((await app.request("/archives/archive:http", {}, env)).status).toBe(expected)
    expect(
      (
        await app.request(
          `/archives/by-employee/${encodeURIComponent(f.people[0]!.employeeId)}`,
          {},
          env,
        )
      ).status,
    ).toBe(expected)
  }
  state.actor = administrator
  expect((await app.request("/archives?employee_id=employee:missing", {}, env)).status).toBe(404)
  expect((await app.request("/archives/archive:missing", {}, env)).status).toBe(404)
  expect((await post({ ...input, actorAccountId: "forged:account" })).status).toBe(400)
  expect((await post({ ...input, recordedAt: 1 })).status).toBe(400)
  expect((await post({ ...input, employmentId: "inferred:employment" })).status).toBe(400)
  expect((await post({ ...input, observedOn: "2020-01-01" })).status).toBe(409)
  expect((await post({ ...input, expectedRevision: input.expectedRevision + 1 })).status).toBe(409)
  expect((await post()).status).toBe(201)
  expect((await post()).status).toBe(200)
  expect(await f.companyRevision()).toBe(input.expectedRevision)
  const audit = await f.database
    .prepare(
      "SELECT actor_account_id, authorization_json, metadata_json FROM system_audit_events WHERE action = 'company.grade-award.archive'",
    )
    .first<{ actor_account_id: string; authorization_json: string; metadata_json: string }>()
  expect(audit?.actor_account_id).toBe(administrator.accountId)
  expect(JSON.parse(audit?.authorization_json ?? "null")).toMatchObject({
    actorEmployeeId: null,
    capability: "company:admin",
    purpose: "preserve_original_records",
  })
  expect(JSON.parse(audit?.metadata_json ?? "null")).toEqual(f.context.var.auditContext)
  await f.database.exec("DROP TABLE company_employee_grades; DROP TABLE company_grade_definitions;")
  expect((await post()).status).toBe(200)
  const foundByEmployee = await app.request(
    `/archives/by-employee/${encodeURIComponent(f.people[0]!.employeeId)}`,
    {},
    env,
  )
  expect(foundByEmployee.status).toBe(200)
  expect(await foundByEmployee.json()).toMatchObject({
    commandId: "archive:http",
    employeeId: f.people[0]!.employeeId,
  })
  expect((await app.request("/archives/by-employee/employee:missing", {}, env)).status).toBe(404)
  const evidence = await app.request("/archives/archive:http", {}, env)
  expect(evidence.status).toBe(200)
  expect(await evidence.json()).toMatchObject({
    employeeId: f.people[0]!.employeeId,
    actorAccountId: administrator.accountId,
    observedCompanyRevision: input.expectedRevision,
  })
  for (const reader of [
    CompanyActorValue.restore({
      accountId: "account:self",
      employeeId: f.people[0]!.employeeId,
      organizationIds: ["organization:default"],
      capabilities: [],
    }),
    CompanyActorValue.restore({
      accountId: "account:reader",
      employeeId: null,
      organizationIds: ["organization:default"],
      capabilities: [],
      permissions: ["employee:attributes:read"],
    }),
  ]) {
    state.actor = reader
    expect(
      (
        await app.request(
          `/archives/by-employee/${encodeURIComponent(f.people[0]!.employeeId)}`,
          {},
          env,
        )
      ).status,
    ).toBe(200)
    expect((await post(input)).status).toBe(403)
  }
  state.actor = CompanyActorValue.restore({
    accountId: "account:other",
    employeeId: "employee:other",
    organizationIds: ["organization:default"],
    capabilities: [],
  })
  expect(
    (
      await app.request(
        `/archives/by-employee/${encodeURIComponent(f.people[0]!.employeeId)}`,
        {},
        env,
      )
    ).status,
  ).toBe(403)
  state.actor = undefined
  expect((await post()).status).toBe(401)
})
