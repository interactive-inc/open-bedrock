import { describe, expect, test } from "bun:test"
import { eq } from "drizzle-orm"
import { AttachExpenseAttachments } from "@/contexts/expense/application/attach-expense-attachments"
import { Expense } from "@/contexts/expense/domain/expense.entity"
import { ExpenseRepository } from "@/contexts/expense/infrastructure/expense-repository"
import { expenseAttachments } from "@/contexts/expense/infrastructure/schema/expense"
import { StoreAttachment } from "@system/application/attachments/store-attachment"
import { AttachmentRepository } from "@system/infrastructure/attachments/attachment-repository"
import { createTestContext } from "@/api/test/support/create-test-context"
import { R2TestBucket, testKekEnv } from "@/api/test/support/r2-test-bucket"
import type { Context } from "@/env"

const ownerAccountId = "acc_owner"

const otherAccountId = "acc_other"

const now = new Date("2026-08-20T09:00:00.000Z")

function withAttachmentStorage(context: Context, bucket: R2TestBucket): Context {
  return {
    ...context,
    env: {
      ...context.env,
      ATTACHMENTS: bucket as unknown as R2Bucket,
      ATTACHMENT_KEKS: testKekEnv(1),
    },
  }
}

async function seedExpense(context: Context): Promise<number> {
  const created = await new ExpenseRepository(context).create(
    Expense.create({
      employeeId: 1,
      category: "transport",
      amount: 12800,
      spentAt: "2026-08-20",
      note: null,
      createdAt: now.toISOString(),
    }),
  )

  if (created instanceof Error || created.id === null) throw new Error("seed failed")

  return created.id
}

async function storeAttachment(context: Context, accountId: string): Promise<string> {
  const stored = await new StoreAttachment(context).run({
    ownerAccountId: accountId,
    fileName: "領収書.pdf",
    contentType: "application/pdf",
    content: new TextEncoder().encode("%PDF-1.7 領収書 12,800円"),
    now,
  })

  if (stored instanceof Error) throw stored

  return stored.id
}

describe("AttachExpenseAttachments", () => {
  test("本人の添付を経費へ紐づけ、System 側は linked になる", async () => {
    const bucket = new R2TestBucket()

    const context = withAttachmentStorage(createTestContext().context, bucket)

    const expenseId = await seedExpense(context)

    const attachmentId = await storeAttachment(context, ownerAccountId)

    const attached = await new AttachExpenseAttachments(context).run({
      expenseId,
      attachmentIds: [attachmentId],
      ownerAccountId,
      now,
    })

    expect(attached).toBeUndefined()

    const links = await context.var.database
      .select()
      .from(expenseAttachments)
      .where(eq(expenseAttachments.expenseId, expenseId))

    expect(links.map((link) => link.attachmentId)).toEqual([attachmentId])

    const row = await new AttachmentRepository(context).findById(attachmentId)

    if (row instanceof Error || row === null) throw new Error("行が無い")

    expect(row.status).toBe("linked")
  })

  test("他人の添付は紐づけできず、対応も作らない", async () => {
    const bucket = new R2TestBucket()

    const context = withAttachmentStorage(createTestContext().context, bucket)

    const expenseId = await seedExpense(context)

    const attachmentId = await storeAttachment(context, otherAccountId)

    const attached = await new AttachExpenseAttachments(context).run({
      expenseId,
      attachmentIds: [attachmentId],
      ownerAccountId,
      now,
    })

    expect(attached).toBeInstanceOf(Error)

    const links = await context.var.database
      .select()
      .from(expenseAttachments)
      .where(eq(expenseAttachments.expenseId, expenseId))

    expect(links).toEqual([])
  })

  test("添付なしの申請は何もしない", async () => {
    const bucket = new R2TestBucket()

    const context = withAttachmentStorage(createTestContext().context, bucket)

    const expenseId = await seedExpense(context)

    const attached = await new AttachExpenseAttachments(context).run({
      expenseId,
      attachmentIds: [],
      ownerAccountId,
      now,
    })

    expect(attached).toBeUndefined()
    expect(bucket.size()).toBe(0)
  })
})
