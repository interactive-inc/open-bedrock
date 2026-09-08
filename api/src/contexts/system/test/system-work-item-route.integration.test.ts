import { expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"
import { createSystemWorkTestFixture } from "@system/test/create-system-work-test-fixture.test-support"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { SystemHTTPException } from "@system/interface/errors"
import { AccessTokenService } from "@system/lib/auth/access-token-service"
import { SYSTEM_ACCESS_TOKEN_PROFILE } from "@system/lib/auth/system-access-token-profile"
import { POST as CREATE, GET as LIST } from "@system/interface/routes/system.work-items"
import { GET as DETAIL } from "@system/interface/routes/system.work-items.$id"
import { GET as HISTORY } from "@system/interface/routes/system.work-items.$id.history"
import { GET as EVIDENCE } from "@system/interface/routes/system.work-items.$id.evidence.$attachmentId"
import { POST as ACCEPT } from "@system/interface/routes/system.work-items.$id.accept"
import { POST as SUBMIT } from "@system/interface/routes/system.work-items.$id.results"
import { POST as APPROVE } from "@system/interface/routes/system.work-items.$id.approve"
import { POST as RETURN } from "@system/interface/routes/system.work-items.$id.return"
import { POST as HANDOVER } from "@system/interface/routes/system.work-items.$id.handovers"
import { POST as RECEIVE } from "@system/interface/routes/system.work-items.$id.handovers.accept"
import { POST as DECLINE } from "@system/interface/routes/system.work-items.$id.handovers.decline"
import { POST as CANCEL } from "@system/interface/routes/system.work-items.$id.cancel"
import { POST as UPLOAD } from "@system/interface/routes/system.attachments"
import {
  systemWorkCommandResponseSchema,
  systemWorkListResponseSchema,
  systemWorkHistoryResponseSchema,
} from "@system/interface/http/work-item-response-schemas"
import { SystemAttachmentTestBucket } from "@system/test/system-attachment-test-bucket.test-support"
import { createSystemAttachmentTestKekEnvironment } from "@system/test/create-system-attachment-test-kek-environment.test-support"

async function fixture() {
  const f = await createSystemWorkTestFixture()
  const database = drizzle(f.db)
  const bucket = new SystemAttachmentTestBucket()
  const secret = "system-work-api-test-secret"
  const app = systemFactory
    .createApp()
    .use("*", async (c, next) => {
      c.set("now", () => f.clock.now)
      c.set("database", database)
      await next()
    })
    .onError((error, c) =>
      error instanceof SystemHTTPException
        ? c.json({ error: error.code }, error.status)
        : c.json({ error: "internal" }, 500),
    )
    .post("/system/work-items", ...CREATE)
    .get("/system/work-items", ...LIST)
    .get("/system/work-items/:id", ...DETAIL)
    .get("/system/work-items/:id/history", ...HISTORY)
    .get("/system/work-items/:id/evidence/:attachmentId", ...EVIDENCE)
    .post("/system/work-items/:id/accept", ...ACCEPT)
    .post("/system/work-items/:id/results", ...SUBMIT)
    .post("/system/work-items/:id/approve", ...APPROVE)
    .post("/system/work-items/:id/return", ...RETURN)
    .post("/system/work-items/:id/handovers", ...HANDOVER)
    .post("/system/work-items/:id/handovers/accept", ...RECEIVE)
    .post("/system/work-items/:id/handovers/decline", ...DECLINE)
    .post("/system/work-items/:id/cancel", ...CANCEL)
    .post("/system/attachments", ...UPLOAD)
  const headers = new Map<string, Record<string, string>>()
  for (const account of ["owner", "worker", "recipient", "other", "admin"]) {
    const token = await new AccessTokenService({ profile: SYSTEM_ACCESS_TOKEN_PROFILE }).create(
      {
        accountId: account,
        tokenVersion: 0,
        ...(account === "worker" ? { machineCredentialId: "credential:worker" } : {}),
      },
      secret,
      new Date(f.claims(account).issuedAtMs),
    )
    if (token instanceof Error) throw token
    headers.set(account, {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(f.stepUpTokens.has(account)
        ? { "x-system-step-up": f.stepUpTokens.get(account) ?? "" }
        : {}),
    })
  }
  function request(path: string, init: RequestInit = {}) {
    return app.request(path, init, {
      DB: f.db,
      JWT_SECRET: secret,
      ATTACHMENTS: bucket as unknown as R2Bucket,
      ATTACHMENT_KEKS: createSystemAttachmentTestKekEnvironment(1),
    })
  }
  const command = {
    id: crypto.randomUUID(),
    commandId: crypto.randomUUID(),
    expectedRevision: 0,
    reason: "依頼する",
    title: "資料の確認",
    instructions: "根拠をまとめる",
    acceptanceCriteria: "人が根拠と結論を確認する",
    assigneeAccountId: "worker",
    dueAt: null,
    previousRevisionId: null,
  }
  function post(path: string, body: unknown, account = "owner") {
    return request(path, {
      method: "POST",
      headers: headers.get(account),
      body: JSON.stringify(body),
    })
  }
  function operation(expectedRevision: number, extra: Record<string, unknown> = {}) {
    return { commandId: crypto.randomUUID(), expectedRevision, reason: "確認した", ...extra }
  }
  async function create() {
    const response = await post("/system/work-items", command)
    expect(response.status).toBe(201)
    return systemWorkCommandResponseSchema.parse(await response.json()).workItem
  }
  async function submit(evidence: ReadonlyArray<{ attachmentId: string; sha256: string }> = []) {
    await create()
    expect(
      (await post(`/system/work-items/${command.id}/accept`, operation(1), "worker")).status,
    ).toBe(201)
    const response = await post(
      `/system/work-items/${command.id}/results`,
      operation(2, { result: { summary: "確認用の成果", evidence } }),
      "worker",
    )
    expect(response.status).toBe(201)
    return systemWorkCommandResponseSchema.parse(await response.json()).workItem
  }
  return { ...f, bucket, headers, request, post, operation, create, submit, command }
}

test("APIは同時再送を一件に集約し、別の内容・別のactor・旧版を拒否する", async () => {
  const f = await fixture()
  const responses = await Promise.all([
    f.post("/system/work-items", f.command),
    f.post("/system/work-items", f.command),
  ])
  expect(responses.map((r) => r.status).toSorted((left, right) => left - right)).toEqual([200, 201])
  expect((await f.post("/system/work-items", { ...f.command, title: "別内容" })).status).toBe(409)
  expect((await f.post("/system/work-items", f.command, "other")).status).toBe(409)
  expect(
    (await f.post(`/system/work-items/${f.command.id}/accept`, f.operation(1), "other")).status,
  ).toBe(404)
  const competing = await Promise.all([
    f.post(`/system/work-items/${f.command.id}/accept`, f.operation(1), "worker"),
    f.post(`/system/work-items/${f.command.id}/accept`, f.operation(1), "worker"),
  ])
  expect(competing.map((r) => r.status).toSorted((left, right) => left - right)).toEqual([201, 409])
  expect(f.sqlite.query("SELECT count(*) AS total FROM system_work_item_revisions").get()).toEqual({
    total: 2,
  })
  f.sqlite.close()
})

test("AI成果を独立した人が再認証して確認し、完了後は変更できない", async () => {
  const f = await fixture()
  const submitted = await f.submit()
  const approval = f.operation(3, {
    resultId: submitted.result?.id,
    resultDigest: submitted.result?.digest,
  })
  expect(
    (await f.post(`/system/work-items/${f.command.id}/approve`, approval, "worker")).status,
  ).toBe(403)
  const plain = { ...f.headers.get("owner") }
  delete plain["x-system-step-up"]
  expect(
    (
      await f.request(`/system/work-items/${f.command.id}/approve`, {
        method: "POST",
        headers: plain,
        body: JSON.stringify(approval),
      })
    ).status,
  ).toBe(403)
  const response = await f.post(`/system/work-items/${f.command.id}/approve`, approval)
  expect(response.status).toBe(201)
  expect(systemWorkCommandResponseSchema.parse(await response.json()).workItem.state).toBe(
    "completed",
  )
  expect((await f.post(`/system/work-items/${f.command.id}/approve`, approval)).status).toBe(200)
  expect((await f.post(`/system/work-items/${f.command.id}/cancel`, f.operation(4))).status).toBe(
    409,
  )
  expect(
    (await f.request(`/system/work-items/${f.command.id}`, { headers: f.headers.get("other") }))
      .status,
  ).toBe(404)
  const history = await f.request(`/system/work-items/${f.command.id}/history?limit=2`, {
    headers: f.headers.get("owner"),
  })
  expect(systemWorkHistoryResponseSchema.parse(await history.json()).nextRevision).toBe(2)
  const listing = await f.request("/system/work-items", { headers: f.headers.get("other") })
  expect(systemWorkListResponseSchema.parse(await listing.json()).workItems).toEqual([])
  f.sqlite.close()
})

test("差戻しは前の成果を保持し、新しい成果の確認に古いdigestを使えない", async () => {
  const f = await fixture()
  const submitted = await f.submit()
  const oldResult = { resultId: submitted.result?.id, resultDigest: submitted.result?.digest }
  expect(
    (await f.post(`/system/work-items/${f.command.id}/return`, f.operation(3, oldResult))).status,
  ).toBe(201)
  const response = await f.post(
    `/system/work-items/${f.command.id}/results`,
    f.operation(4, { result: { summary: "修正した成果", evidence: [] } }),
    "worker",
  )
  expect(response.status).toBe(201)
  const updated = systemWorkCommandResponseSchema.parse(await response.json()).workItem
  expect(
    (await f.post(`/system/work-items/${f.command.id}/approve`, f.operation(5, oldResult))).status,
  ).toBe(409)
  expect(
    (
      await f.post(
        `/system/work-items/${f.command.id}/approve`,
        f.operation(5, { resultId: updated.result?.id, resultDigest: updated.result?.digest }),
      )
    ).status,
  ).toBe(201)
  f.sqlite.close()
})

test("引き継ぎ先は辞退も受領も選べ、責任と閲覧は受領時に切り替わる", async () => {
  const f = await fixture()
  await f.create()
  const request = await f.post(
    `/system/work-items/${f.command.id}/handovers`,
    f.operation(1, { toAccountId: "recipient" }),
  )
  expect(request.status).toBe(201)
  const offered = systemWorkCommandResponseSchema.parse(await request.json()).workItem
  expect(
    (await f.post(`/system/work-items/${f.command.id}/accept`, f.operation(2), "worker")).status,
  ).toBe(409)
  expect(
    (
      await f.post(
        `/system/work-items/${f.command.id}/handovers/accept`,
        f.operation(2, { handoverId: offered.handover?.id }),
        "other",
      )
    ).status,
  ).toBe(404)
  expect(
    (
      await f.post(
        `/system/work-items/${f.command.id}/handovers/decline`,
        f.operation(2, { handoverId: offered.handover?.id }),
        "recipient",
      )
    ).status,
  ).toBe(201)
  const retry = await f.post(
    `/system/work-items/${f.command.id}/handovers`,
    f.operation(3, { toAccountId: "recipient" }),
  )
  const next = systemWorkCommandResponseSchema.parse(await retry.json()).workItem
  expect(
    (
      await f.post(
        `/system/work-items/${f.command.id}/handovers/accept`,
        f.operation(4, { handoverId: next.handover?.id }),
        "recipient",
      )
    ).status,
  ).toBe(201)
  expect(
    (
      await f.request(`/system/work-items/${f.command.id}/history`, {
        headers: f.headers.get("owner"),
      })
    ).status,
  ).toBe(404)
  expect(
    (await f.post(`/system/work-items/${f.command.id}/cancel`, f.operation(5), "recipient")).status,
  ).toBe(201)
  f.sqlite.close()
})

test("両当事者が失権した引き継ぎを管理者が復旧し、新しい人の受領まで責任を維持する", async () => {
  const f = await fixture()
  await f.create()
  const path = `/system/work-items/${f.command.id}/handovers`
  const first = await f.post(path, f.operation(1, { toAccountId: "recipient" }))
  expect(first.status).toBe(201)
  const original = systemWorkCommandResponseSchema.parse(await first.json()).workItem
  expect((await f.post(path, f.operation(2, { toAccountId: "other" }))).status).toBe(409)
  expect(
    (await f.post(path, f.operation(2, { toAccountId: "other", recovery: true }))).status,
  ).toBe(400)
  f.sqlite.exec(
    "DELETE FROM system_iam_role_permissions WHERE role_id IN ('role:owner','role:recipient')",
  )
  const replacement = await f.post(path, f.operation(2, { toAccountId: "other" }), "admin")
  expect(replacement.status).toBe(201)
  const pending = systemWorkCommandResponseSchema.parse(await replacement.json()).workItem
  expect(String(pending.accountable.accountId)).toBe("owner")
  expect(pending.recovery).toBe(true)
  expect(pending.handover?.id).not.toBe(original.handover?.id)
  expect(
    (await f.post(`${path}/accept`, f.operation(3, { handoverId: original.handover?.id }), "other"))
      .status,
  ).toBe(409)
  const received = await f.post(
    `${path}/accept`,
    f.operation(3, { handoverId: pending.handover?.id }),
    "other",
  )
  expect(received.status).toBe(201)
  expect(
    String(
      systemWorkCommandResponseSchema.parse(await received.json()).workItem.accountable.accountId,
    ),
  ).toBe("other")
  const history = await (
    await f.authorized("admin")
  ).repository.history({
    id: f.command.id,
    after: 0,
    limit: 50,
  })
  if (history instanceof Error) throw history
  expect(history.map((entry) => entry.snapshot.handover?.to.accountId.toString() ?? null)).toEqual([
    null,
    "recipient",
    "other",
    null,
  ])
  f.sqlite.close()
})

test("未認証、主体の偽装、machine依頼、入力の余分な項目を公開APIで拒否する", async () => {
  const f = await fixture()
  expect((await f.request("/system/work-items")).status).toBe(401)
  expect((await f.post("/system/work-items", f.command, "worker")).status).toBe(403)
  expect(
    (await f.post("/system/work-items", { ...f.command, actor: { accountId: "admin" } })).status,
  ).toBe(400)
  expect(
    (await f.post("/system/work-items", { ...f.command, assigneeAccountId: "missing" })).status,
  ).toBe(400)
  expect(
    (await f.post("/system/work-items", { ...f.command, previousRevisionId: crypto.randomUUID() }))
      .status,
  ).toBe(409)
  expect(f.sqlite.query("SELECT count(*) AS total FROM system_work_items").get()).toEqual({
    total: 0,
  })
  f.sqlite.close()
})

async function evidenceFixture() {
  const f = await fixture()
  const form = new FormData()
  const plaintext = "%PDF-1.7 確認の根拠"
  form.set("file", new File([plaintext], "evidence.pdf", { type: "application/pdf" }))
  const upload = await f.request("/system/attachments", {
    method: "POST",
    headers: { authorization: f.headers.get("worker")?.authorization ?? "" },
    body: form,
  })
  expect(upload.status).toBe(201)
  const uploaded = await upload.json()
  if (
    typeof uploaded !== "object" ||
    uploaded === null ||
    !("id" in uploaded) ||
    typeof uploaded.id !== "string" ||
    !("sha256" in uploaded) ||
    typeof uploaded.sha256 !== "string"
  )
    throw new Error("upload response invalid")
  const submitted = await f.submit([{ attachmentId: uploaded.id, sha256: uploaded.sha256 }])
  const path = `/system/work-items/${f.command.id}/evidence/${uploaded.id}`
  return {
    ...f,
    uploaded: { id: uploaded.id, sha256: uploaded.sha256 },
    submitted,
    plaintext,
    path,
  }
}

test("証拠の本文を参加者だけに開示し、内容と版を開示監査へ結び付ける", async () => {
  const f = await evidenceFixture()
  expect((await f.request(f.path, { headers: f.headers.get("other") })).status).toBe(404)
  const response = await f.request(f.path, { headers: f.headers.get("owner") })
  expect(response.status).toBe(200)
  expect(response.headers.get("cache-control")).toBe("no-store")
  expect(await response.text()).toBe(f.plaintext)
  const row = f.sqlite
    .query<{ metadata_json: string }, []>(
      "SELECT metadata_json FROM system_audit_events WHERE action='system.work.evidence.read'",
    )
    .get()
  expect(JSON.parse(row?.metadata_json ?? "null")).toEqual({
    attachmentId: f.uploaded.id,
    sha256: f.uploaded.sha256,
    byteSize: new TextEncoder().encode(f.plaintext).byteLength,
    revision: 3,
  })
  f.sqlite.close()
})

test("復号中に責任・権限・添付が変わった場合は証拠を返さず開示監査も残さない", async () => {
  for (const changed of ["permission", "work", "attachment"]) {
    const f = await evidenceFixture()
    const get = f.bucket.get.bind(f.bucket)
    f.bucket.get = async (key) => {
      const object = await get(key)
      if (changed === "permission")
        f.sqlite.exec("DELETE FROM system_iam_role_permissions WHERE role_id='role:owner'")
      if (changed === "attachment")
        f.sqlite.exec("UPDATE system_attachments SET file_name='changed.pdf'")
      if (changed === "work")
        expect(
          (
            await f.post(
              `/system/work-items/${f.command.id}/handovers`,
              f.operation(3, { toAccountId: "recipient" }),
            )
          ).status,
        ).toBe(201)
      return object
    }
    const response = await f.request(f.path, { headers: f.headers.get("owner") })
    expect(response.status).not.toBe(200)
    expect(await response.text()).not.toContain(f.plaintext)
    expect(
      f.sqlite
        .query(
          "SELECT count(*) AS total FROM system_audit_events WHERE action='system.work.evidence.read'",
        )
        .get(),
    ).toEqual({ total: 0 })
    f.sqlite.close()
  }
})

test("開示監査が保存されない場合と証拠が壊れている場合は本文を渡さない", async () => {
  const f = await evidenceFixture()
  f.sqlite.exec(
    "CREATE TRIGGER ignore_disclosure BEFORE INSERT ON system_audit_events WHEN NEW.action='system.work.evidence.read' BEGIN SELECT RAISE(IGNORE); END;",
  )
  expect((await f.request(f.path, { headers: f.headers.get("owner") })).status).toBe(503)
  f.sqlite.exec("DROP TRIGGER ignore_disclosure")
  await f.bucket.put(`att/${f.uploaded.id}`, new Uint8Array([1, 2, 3]))
  expect((await f.request(f.path, { headers: f.headers.get("owner") })).status).toBe(503)
  expect(
    f.sqlite
      .query(
        "SELECT count(*) AS total FROM system_audit_events WHERE action='system.work.evidence.read'",
      )
      .get(),
  ).toEqual({ total: 0 })
  f.sqlite.close()
})
