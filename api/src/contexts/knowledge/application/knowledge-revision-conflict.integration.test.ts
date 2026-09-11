import { expect, test } from "bun:test"
import { createTestContext } from "@tests/api/support/create-test-context"
import { createTestToken } from "@tests/api/support/create-test-token"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"

test("a stale knowledge edit cannot replace the text another edit already saved", async () => {
  const fixture = await createTestContext({ withCompanyOrganization: true })
  await seedIamForEmployees(fixture.db)
  await fixture.db
    .prepare(`INSERT INTO knowledge_articles
    (id,title,category,tags,body_md,author_id,created_at)
    VALUES (1,'Procedure','Operations',NULL,'Original instructions',?1,'2026-01-01T00:00:00Z')`)
    .bind(toWorkforceEmployeeId(1))
    .run()
  const jwtSecret = "knowledge-revision-test-secret"
  const token = await createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(1) })
  const request = {
    db: fixture.db,
    jwtSecret,
    token,
    now: new Date().toISOString(),
    path: "/knowledge/knowledge-articles/1",
    method: "PUT",
    headers: { "if-match": '"1"', "idempotency-key": "knowledge:first" },
    body: {
      reason: "Instructions reviewed",
      title: "Procedure",
      category: "Operations",
      body_md: "Reviewed new instructions",
    },
  }
  expect((await requestWithContext(request)).status).toBe(200)

  const stale = await requestWithContext({
    ...request,
    headers: { ...request.headers, "idempotency-key": "knowledge:stale" },
    body: { ...request.body, body_md: "Stale editor instructions" },
  })
  expect(stale.status).toBe(409)
  expect(
    await fixture.db
      .prepare("SELECT body_md FROM knowledge_articles WHERE id=1")
      .first<string>("body_md"),
  ).toBe("Reviewed new instructions")
  const detail = await requestWithContext({ ...request, method: "GET", body: undefined })
  expect(detail.headers.get("etag")).toBe('"2"')
  expect(await detail.json()).toMatchObject({
    revision: 2,
    status: "active",
    body_md: "Reviewed new instructions",
  })
  const replay = await requestWithContext(request)
  expect(replay.status).toBe(200)
  expect(await replay.json()).toMatchObject({ revision: 2, status: "active" })
  const missingConfirmation = await requestWithContext({ ...request, headers: {} })
  expect(missingConfirmation.status).toBe(400)

  const withdrawal = {
    ...request,
    method: "DELETE",
    headers: { "if-match": '"2"', "idempotency-key": "knowledge:withdraw" },
    body: { reason: "Instructions superseded" },
  }
  expect((await requestWithContext(withdrawal)).status).toBe(204)
  expect((await requestWithContext(withdrawal)).status).toBe(204)
  const withdrawn = await requestWithContext({ ...request, method: "GET", body: undefined })
  expect(await withdrawn.json()).toMatchObject({
    revision: 3,
    status: "withdrawn",
    body_md: "Reviewed new instructions",
  })
  const list = await requestWithContext({
    ...request,
    method: "GET",
    path: "/knowledge/knowledge-articles",
    body: undefined,
  })
  expect(await list.json()).toMatchObject({ data: [], total: 0 })
  const historyRequest = {
    ...request,
    method: "GET",
    path: "/knowledge/knowledge-articles/1/revisions?limit=1",
    body: undefined,
  }
  const history = await requestWithContext(historyRequest)
  expect(history.status).toBe(200)
  expect(await history.json()).toMatchObject({
    total: 2,
    data: [
      {
        revision: 3,
        reason: "Instructions superseded",
        source: "actor",
        article: { status: "withdrawn", body_md: "Reviewed new instructions" },
      },
    ],
  })
  const older = await requestWithContext({
    ...historyRequest,
    path: historyRequest.path + "&offset=1",
  })
  expect(await older.json()).toMatchObject({
    total: 2,
    data: [{ revision: 2, article: { status: "active" } }],
  })
  expect((await requestWithContext({ ...historyRequest, token: null })).status).toBe(401)
})

test("new article API records the initial version and requires a stable retry key", async () => {
  const fixture = await createTestContext({ withCompanyOrganization: true })
  await seedIamForEmployees(fixture.db)
  const jwtSecret = "knowledge-create-test-secret"
  const token = await createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(1) })
  const request = {
    db: fixture.db,
    jwtSecret,
    token,
    now: new Date().toISOString(),
    path: "/knowledge/knowledge-articles",
    method: "POST",
    headers: { "idempotency-key": "knowledge:create" },
    body: {
      title: "New procedure",
      category: "Operations",
      body_md: "Initial instructions",
      reason: "Procedure established",
    },
  }
  const response = await requestWithContext(request)
  expect(response.status).toBe(201)
  const created = (await response.json()) as { id: number; revision: number }
  expect(created.revision).toBe(1)
  expect(await (await requestWithContext(request)).json()).toEqual(created)
  expect((await requestWithContext({ ...request, headers: {} })).status).toBe(400)
  expect(
    (
      await requestWithContext({
        ...request,
        body: { ...request.body, body_md: "Different instructions" },
      })
    ).status,
  ).toBe(409)
  const history = await requestWithContext({
    ...request,
    path: `/knowledge/knowledge-articles/${created.id}/revisions`,
    method: "GET",
    body: undefined,
  })
  expect(await history.json()).toMatchObject({
    total: 1,
    data: [
      {
        revision: 1,
        reason: "Procedure established",
        article: { body_md: "Initial instructions" },
      },
    ],
  })
})
