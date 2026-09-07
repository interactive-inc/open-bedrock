import { expect, spyOn, test } from "bun:test"
import { app } from "@/api/app"
import type { Bindings } from "@/env"
import { createExpenseProcedureTestContext } from "@/contexts/expense/test/expense-procedure.test-support"
import { SystemAccessTokenIssuer } from "@system/lib/auth/system-access-token-issuer"
import { SystemAttachmentTestBucket } from "@system/test/system-attachment-test-bucket.test-support"
import { createSystemAttachmentTestKekEnvironment } from "@system/test/create-system-attachment-test-kek-environment.test-support"
import { z } from "zod"

async function fixture() {
  const c = await createExpenseProcedureTestContext()
  const bucket = new SystemAttachmentTestBucket()
  const secret = "expense-attachment-http-test-secret"
  const bindings: Bindings = {
    DB: c.database,
    JWT_SECRET: secret,
    PEPPER_SECRET: "expense-attachment-test-pepper",
    AUDIT_HMAC_SECRET: "expense-attachment-test-audit",
    NOW: c.at.toISOString(),
    COMPANY_TIME_ZONE: "Asia/Tokyo",
    ATTACHMENTS: bucket as unknown as R2Bucket,
    ATTACHMENT_KEKS: createSystemAttachmentTestKekEnvironment(1),
  }
  const request = async (person: typeof c.requester, path: string, body?: FormData) => {
    const token = await new SystemAccessTokenIssuer(secret).issue({
      accountId: person.accountId,
      tokenVersion: 0,
      now: c.at,
    })
    if (token instanceof Error) throw token
    return app.request(
      path,
      {
        method: body === undefined ? "GET" : "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      },
      bindings,
    )
  }
  const content = "%PDF-1.4\nReceipt evidence\n%%EOF"
  const form = new FormData()
  form.set("file", new File([content], "receipt.pdf", { type: "application/pdf" }))
  const uploaded = await request(c.requester, "/system/attachments", form)
  expect(uploaded.status).toBe(201)
  const { id: attachmentId } = z.object({ id: z.string() }).parse(await uploaded.json())
  const submitted = await c.submit.run({ ...c.command, attachmentIds: [attachmentId] })
  if (submitted instanceof Error) throw submitted
  const path = `/expense/expenses/${submitted.request.id}/attachments/${attachmentId}`
  const auditCount = () =>
    c.database
      .prepare(
        "SELECT count(*) AS total FROM system_audit_events WHERE action = 'expense.attachment.read'",
      )
      .first<number>("total")
  return { ...c, request, bucket, attachmentId, path, content, auditCount }
}

test("経費の添付は現在の判断資格で復号し、資格失効・改変・監査失敗では返さない", async () => {
  const c = await fixture()
  const downloaded = await c.request(c.first, c.path)
  expect(downloaded.status).toBe(200)
  expect(downloaded.headers.get("cache-control")).toBe("no-store")
  expect(await downloaded.text()).toBe(c.content)
  expect(await c.auditCount()).toBe(1)
  await c.revokeFirstVoting()
  expect((await c.request(c.first, c.path)).status).toBe(403)
  await c.database.exec(
    "CREATE TRIGGER fail_expense_attachment_audit BEFORE INSERT ON system_audit_events WHEN NEW.action = 'expense.attachment.read' BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END",
  )
  const failedAudit = await c.request(c.requester, c.path)
  expect(failedAudit.status).toBe(500)
  expect(await failedAudit.text()).not.toContain(c.content)
  expect(await c.auditCount()).toBe(1)
  await c.database.exec("DROP TRIGGER fail_expense_attachment_audit")
  await c.database
    .prepare("UPDATE system_attachments SET plaintext_sha256 = ?1 WHERE id = ?2")
    .bind("b".repeat(64), c.attachmentId)
    .run()
  const changed = await c.request(c.requester, c.path)
  expect(changed.status).toBe(422)
  expect(await changed.text()).not.toContain(c.content)
  expect(await c.auditCount()).toBe(1)
})

test("復号中に消去された領収書を本人にも返さず、成功監査を残さない", async () => {
  const c = await fixture()
  const get = c.bucket.get.bind(c.bucket)
  const interception = spyOn(c.bucket, "get").mockImplementation(async (key) => {
    const object = await get(key)
    await c.database
      .prepare(
        "UPDATE system_attachments SET status = 'erased', wrapped_dek = NULL, wrapped_dek_iv = NULL WHERE id = ?1",
      )
      .bind(c.attachmentId)
      .run()
    return object
  })
  try {
    const response = await c.request(c.requester, c.path)
    expect(response.status).toBe(422)
    expect(await response.text()).not.toContain(c.content)
  } finally {
    interception.mockRestore()
  }
  expect(await c.auditCount()).toBe(0)
})
