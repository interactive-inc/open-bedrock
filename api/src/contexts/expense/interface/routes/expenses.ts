import { AttachmentAdapter } from "@system/infrastructure/adapters/attachments/attachment.adapter"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"

import { expenseAttachments } from "@/contexts/expense/infrastructure/schema/expense"
import { UnexpectedError } from "@/lib/errors"

import { SubmitExpense } from "@/contexts/expense/application/submit-expense"
import { factory } from "@/api/http/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppExpense } from "@/lib/app-schemas"
import { expenseCategorySchema, isoDate } from "@/lib/schemas"
import { toHttpException } from "@/lib/http/to-http-exception"
import { verifyBearer } from "@/api/http/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { UnauthorizedError } from "@/lib/http/errors"
import { z } from "zod"

// @authorization owner - 本人のリソースに限定する
/** POST /expenses — 本人の経費を申請する（submit = create） */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      category: expenseCategorySchema,
      amount: z.number().positive().int().safe(),
      spent_at: isoDate,
      note: z.string().max(3_000).optional(),
      attachment_ids: z.array(z.string().min(1).max(64)).max(10).optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const body = c.req.valid("json")

    const created = await new SubmitExpense(c).run({
      employeeId: session.employeeId,
      category: body.category,
      amount: body.amount,
      spentAt: body.spent_at,
      note: body.note ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const attached = await (async () => {
      const attachmentCommand = {
        expenseId: created.id ?? 0,
        attachmentIds: body.attachment_ids ?? [],
        ownerAccountId: String(session.accountId),
        now: c.var.now(),
      }

      if (attachmentCommand.attachmentIds.length === 0) return undefined

      const linked = await (async () => {
        const linkCommand = {
          attachmentIds: attachmentCommand.attachmentIds,
          ownerAccountId: attachmentCommand.ownerAccountId,
          now: attachmentCommand.now,
        }

        if (linkCommand.attachmentIds.length === 0) return undefined

        const unique = new Set(linkCommand.attachmentIds)

        if (unique.size !== linkCommand.attachmentIds.length) {
          return new ValidationError("添付が重複しています", "attachment_duplicated")
        }

        const repository = new AttachmentAdapter(c)

        const rows = await repository.findManyByIds(linkCommand.attachmentIds)

        if (rows instanceof Error) return rows

        if (rows.length !== unique.size) {
          return new NotFoundError("添付が見つかりません", "attachment_not_found")
        }

        for (const row of rows) {
          if (row.ownerAccountId !== linkCommand.ownerAccountId) {
            return new ForbiddenError("他人の添付は紐づけできません", "attachment_not_owned")
          }

          if (row.status !== "pending") {
            return new ValidationError(
              "この添付は紐づけできる状態ではありません",
              "attachment_not_pending",
            )
          }
        }

        for (const row of rows) {
          const linked = await repository.markLinked(row.id, linkCommand.now)

          if (linked instanceof Error) return linked
        }

        return undefined
      })()

      if (linked instanceof ApplicationError) return linked

      if (linked instanceof Error) {
        return new UnexpectedError("failed to link attachments", { cause: linked })
      }

      try {
        await c.var.database.insert(expenseAttachments).values(
          attachmentCommand.attachmentIds.map((attachmentId) => ({
            expenseId: attachmentCommand.expenseId,
            attachmentId,
            createdAt: attachmentCommand.now.toISOString(),
          })),
        )

        return undefined
      } catch (error) {
        return new UnexpectedError("failed to attach expense attachments", { cause: error })
      }
    })()

    if (attached instanceof ApplicationError) {
      throw toHttpException(attached)
    }

    const responseBody = zAppExpense.parse({
      id: created.id,
      employee_id: created.employeeId,
      category: created.category,
      amount: created.amount,
      spent_at: created.spentAt,
      note: created.note,
      status: created.status,
      created_at: created.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
