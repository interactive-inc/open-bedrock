import { AttachmentAdapter } from "@system/infrastructure/adapters/attachments/attachment.adapter"
import { ExpenseRepository } from "@/contexts/expense/infrastructure/repositories/expense.repository"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/database/is-aborted-by-guard"
import {
  ConflictError,
  ForbiddenError as ApplicationForbiddenError,
  NotFoundError as ApplicationNotFoundError,
  UnexpectedError,
} from "@/lib/errors"

import { UpdateExpense } from "@/contexts/expense/application/update-expense"
import { ResolveOrganizationAuthorityAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-organization-authority.adapter"
import type { Expense } from "@/contexts/expense/domain/entities/expense.entity"
import { factory } from "@/api/http/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppExpense, zAppExpenseDetail } from "@/lib/app-schemas"
import { expenseCategorySchema, isoDate } from "@/lib/schemas"
import { toHttpException } from "@/lib/http/to-http-exception"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { verifyBearer } from "@/api/http/verify-bearer"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import { expenseAttachments, expenses } from "@/contexts/expense/infrastructure/schema/expense"
import { eq } from "drizzle-orm"
import { ForbiddenError, InternalError, NotFoundError, UnauthorizedError } from "@/lib/http/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/** 経費をレスポンス用の snake_case に整形する。 */
function toResponseBody(expense: Expense) {
  return {
    id: expense.id,
    employee_id: expense.employeeId,
    category: expense.category,
    amount: expense.amount,
    spent_at: expense.spentAt,
    note: expense.note,
    status: expense.status,
    created_at: expense.createdAt,
  }
}

// @authorization permission - 権限キーで判定する
/** GET /expenses/:id — 経費の詳細（本人または承認権限者のみ） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const expenseId = validateIntParam(c.req.param("id"), "expense")

  const rows = await c.var.database
    .select({ expense: expenses, applicantName: employees.officialName })
    .from(expenses)
    .leftJoin(employees, eq(employees.id, expenses.employeeId))
    .where(eq(expenses.id, expenseId))
    .limit(1)

  const row = rows.at(0)

  if (row === undefined) {
    throw new NotFoundError("expense not found")
  }

  const isOwner = row.expense.employeeId === session.employeeId

  if (isOwner === false && session.hasPermission("expense:read:all") === false) {
    if (session.hasPermission("expense:approve") === false) {
      throw new ForbiddenError()
    }

    if (session.hasPermission("org:manage") === false) {
      const organizationAuthority = await new ResolveOrganizationAuthorityAdapter(
        c,
      ).resolveOrganizationAuthority(session.employeeId, row.expense.employeeId)

      if (organizationAuthority instanceof Error) {
        throw new InternalError("failed to resolve organization scope")
      }

      if (
        organizationAuthority.managementChain === false &&
        organizationAuthority.departmentManager === false
      ) {
        throw new ForbiddenError()
      }
    }
  }

  const links = await c.var.database
    .select({ attachmentId: expenseAttachments.attachmentId })
    .from(expenseAttachments)
    .where(eq(expenseAttachments.expenseId, expenseId))

  const attachments = await (async () => {
    const attachmentIds = links.map((link) => link.attachmentId)

    const rows = await new AttachmentAdapter(c).findManyByIds(attachmentIds)

    if (rows instanceof Error) return rows

    return rows.map((row) => ({
      id: row.id,
      fileName: row.fileName,
      contentType: row.contentType,
      byteSize: row.byteSize,
    }))
  })()

  if (attachments instanceof Error) {
    throw new InternalError("failed to read attachments")
  }

  const responseBody = zAppExpenseDetail.parse({
    id: row.expense.id,
    employee_id: row.expense.employeeId,
    applicant_name: row.applicantName ?? "",
    category: row.expense.category,
    amount: row.expense.amount,
    spent_at: row.expense.spentAt,
    note: row.expense.note,
    status: row.expense.status,
    created_at: row.expense.createdAt,
    attachments: attachments.map((attachment) => ({
      id: attachment.id,
      file_name: attachment.fileName,
      content_type: attachment.contentType,
      byte_size: attachment.byteSize,
    })),
  })

  return c.json(responseBody, 200)
})

// @authorization owner - 本人のリソースに限定する
/** PUT /expenses/:id — 経費申請の内容を変更（本人のみ・pending のみ） */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      category: expenseCategorySchema,
      amount: z.number().positive().int().safe(),
      spent_at: isoDate,
      note: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const expenseId = validateIntParam(c.req.param("id"), "expense")

    const json = c.req.valid("json")

    const expense = await new UpdateExpense(c).run({
      expenseId,
      employeeId: session.employeeId,
      category: json.category,
      amount: json.amount,
      spentAt: json.spent_at,
      note: json.note ?? null,
    })

    if (expense instanceof ApplicationError) {
      throw toHttpException(expense)
    }

    const responseBody = zAppExpense.parse(toResponseBody(expense))

    return c.json(responseBody, 200)
  },
)

// @authorization owner - 本人のリソースに限定する
/** DELETE /expenses/:id — 経費申請を取り下げ（本人のみ・pending のみ） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const expenseId = validateIntParam(c.req.param("id"), "expense")

  const result = await (async () => {
    const command = {
      expenseId,
      employeeId: session.employeeId,
    }

    const repository = new ExpenseRepository(c)

    const current = await repository.findById(command.expenseId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find expense", { cause: current })
    }

    if (current === null) {
      return new ApplicationNotFoundError("expense not found", "expense_not_found")
    }

    if (current.employeeId !== command.employeeId) {
      return new ApplicationForbiddenError("not the owner of expense", "not_owner")
    }

    if (current.status !== "pending") {
      return new ConflictError("expense is not deletable", "not_deletable")
    }

    // expense_approvals と expenses を D1 batch でアトミックに削除する。
    // expenses を status='pending' 付きで先に削除し、承認処理との TOCTOU 競合を防ぐ。
    // 0 行削除（承認済みへ遷移済み）は abortWhenPreviousStatementChangedNoRows で
    // 後続の expense_approvals 削除ごとロールバックし、孤児化を排除する。
    try {
      const db = c.env.DB
      await db.batch([
        db
          .prepare("DELETE FROM expenses WHERE id = ?1 AND status = 'pending'")
          .bind(command.expenseId),
        abortWhenPreviousStatementChangedNoRows(db),
        db.prepare("DELETE FROM expense_approvals WHERE expense_id = ?1").bind(command.expenseId),
      ])
    } catch (error) {
      if (isAbortedByGuard(error)) {
        return new ConflictError("expense is not deletable", "not_deletable")
      }

      return error instanceof Error
        ? new UnexpectedError("failed to delete expense", { cause: error })
        : new UnexpectedError("failed to delete expense")
    }

    return { reason: "deleted" }
  })()

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
