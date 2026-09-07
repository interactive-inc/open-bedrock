import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedExpenseApprovals } from "@/contexts/expense/test/seed/seed-expense-approvals.test-support"
import { seedExpenses } from "@/contexts/expense/test/seed/seed-expenses.test-support"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
import { AttachmentAdapter } from "@system/infrastructure/adapters/attachments/attachment.adapter"
import { drizzle } from "drizzle-orm/d1"

const categoryEnum = z.enum(["transport", "supplies", "entertainment", "books", "other"])

const statusEnum = z.enum(["pending", "approved", "rejected", "settled"])

const expenseResponseSchema = z.object({
  id: z.number(),
  employee_id: zEmployeeId,
  category: categoryEnum,
  amount: z.number(),
  spent_at: z.string(),
  note: z.string().nullable(),
  status: statusEnum,
  created_at: z.string(),
})

const jwtSecret = "expense-create-route-test-secret"

const now = "2026-01-01T00:00:00.000Z"

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await initializeStandardCompanyTestState(db)

  await seedCompanyEmployees(
    db,
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      deptId: employee.deptId,
      deptName: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

  await seedIamForEmployees(db)

  await db.exec(`INSERT INTO system_iam_roles (id,key,kind,name,created_at,updated_at)
    VALUES ('expense-submit-test','test:expense:submit','custom','Expense submit',0,0);
    INSERT INTO system_iam_role_permissions (role_id,permission_key) VALUES ('expense-submit-test','expense:submit');`)
  await db
    .prepare(
      "INSERT INTO system_role_bindings (id,account_id,role_id,created_at) VALUES ('expense-submit-test',?1,'expense-submit-test',0)",
    )
    .bind(String(toWorkforceEmployeeId(5)))
    .run()

  await seedD1(
    db,
    "expenses",
    seedExpenses.map((expense) => ({
      id: expense.id,
      employee_id: expense.employeeId,
      organization_unit_id: expense.organizationUnitId,
      category: expense.category,
      amount: expense.amount,
      spent_at: expense.spentAt,
      note: expense.note,
      status: expense.status,
      created_at: expense.createdAt,
    })),
  )

  await seedD1(
    db,
    "expense_approvals",
    seedExpenseApprovals.map((approval) => ({
      id: approval.id,
      expense_id: approval.expenseId,
      approver_id: approval.approverId,
      action: approval.action,
      comment: approval.comment,
      created_at: approval.createdAt,
    })),
  )
  return db
}

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(employeeId),
  })
}

type RequestProps = {
  path: string
  token: string | null
  method?: string
  body?: unknown
}

async function request(props: RequestProps): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: props.path,
    token: props.token,
    method: props.method,
    body: props.body,
  })
}

describe("POST /expenses", () => {
  test("二件目の添付保存に失敗しても全変更を戻し、再試行で両方を同じ経費へ紐付ける", async () => {
    const db = await createTestDb()
    const attachments = new AttachmentAdapter({ var: { database: drizzle(db) } })
    const ids = ["receipt-first", "receipt-second"]
    for (const id of ids) {
      const stored = await attachments.reserve({
        id,
        ownerAccountId: String(toWorkforceEmployeeId(5)),
        objectKey: `att/${id}`,
        contentType: "application/pdf",
        byteSize: 100,
        fileName: `${id}.pdf`,
        plaintextSha256: "a".repeat(64),
        wrappedDek: "test-key",
        wrappedDekIv: "test-key-iv",
        contentIv: "test-content-iv",
        kekVersion: 1,
        createdAt: new Date(now),
      })
      if (stored instanceof Error) throw stored
      const pending = await attachments.markPending(id)
      if (pending instanceof Error) throw pending
    }
    const before = await db.prepare("SELECT count(*) AS total FROM expenses").first<number>("total")
    const send = async () =>
      requestWithContext({
        db,
        jwtSecret,
        path: "/expense/expenses",
        token: await tokenFor(5),
        method: "POST",
        body: { category: "transport", amount: 500, spent_at: "2026-01-01", attachment_ids: ids },
      })
    await db.exec(
      "CREATE TRIGGER fail_second_expense_attachment BEFORE INSERT ON expense_attachments WHEN NEW.attachment_id = 'receipt-second' BEGIN SELECT RAISE(ABORT, 'attachment unavailable'); END",
    )
    expect((await send()).status).toBe(500)
    expect(await db.prepare("SELECT count(*) AS total FROM expenses").first<number>("total")).toBe(
      before,
    )
    for (const id of ids)
      expect(await attachments.findById(id)).toMatchObject({ status: "pending", linkedAt: null })
    await db.exec("DROP TRIGGER fail_second_expense_attachment")
    const response = await send()
    expect(response.status).toBe(201)
    const expense = expenseResponseSchema.parse(await response.json())
    expect(
      (
        await db
          .prepare(
            "SELECT expense_id,attachment_id FROM expense_attachments ORDER BY attachment_id",
          )
          .all()
      ).results,
    ).toEqual(ids.map((attachment_id) => ({ expense_id: expense.id, attachment_id })))
  })
  test("添付が存在しない場合は申請本体も作らない", async () => {
    const db = await createTestDb()
    const before = await db.prepare("SELECT count(*) AS total FROM expenses").first<number>("total")
    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/expense/expenses",
      token: await tokenFor(5),
      method: "POST",
      body: {
        category: "transport",
        amount: 500,
        spent_at: "2026-01-01",
        attachment_ids: ["missing-attachment"],
      },
    })
    expect(response.status).toBe(404)
    expect(await db.prepare("SELECT count(*) AS total FROM expenses").first<number>("total")).toBe(
      before,
    )
  })
  test("returns 201 with a pending expense from the token employee", async () => {
    const response = await request({
      path: "/expense/expenses",
      token: await tokenFor(5),
      method: "POST",
      body: { category: "transport", amount: 1500, spent_at: "2026-05-25" },
    })

    expect(response.status).toBe(201)

    const parsed = expenseResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("pending")
      expect(parsed.data.employee_id).toBe(toWorkforceEmployeeId(5))
      expect(parsed.data.note).toBeNull()
      expect(parsed.data.created_at).toBe(now)
    }
  })

  test("returns 400 when amount is not positive", async () => {
    const response = await request({
      path: "/expense/expenses",
      token: await tokenFor(5),
      method: "POST",
      body: { category: "transport", amount: 0, spent_at: "2026-05-25" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when amount is not an integer", async () => {
    const response = await request({
      path: "/expense/expenses",
      token: await tokenFor(5),
      method: "POST",
      body: { category: "transport", amount: 1.005, spent_at: "2026-05-25" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when amount exceeds the safe integer range", async () => {
    const response = await request({
      path: "/expense/expenses",
      token: await tokenFor(5),
      method: "POST",
      body: { category: "transport", amount: Number.MAX_SAFE_INTEGER + 2, spent_at: "2026-05-25" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when category is invalid", async () => {
    const response = await request({
      path: "/expense/expenses",
      token: await tokenFor(5),
      method: "POST",
      body: { category: "travel", amount: 100, spent_at: "2026-05-25" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/expense/expenses",
      token: null,
      method: "POST",
      body: { category: "transport", amount: 100, spent_at: "2026-05-25" },
    })

    expect(response.status).toBe(401)
  })
})
