import { AccountProvisioner } from "@/infrastructure/iam/account-provisioner"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { describe, expect, test } from "bun:test"

async function countRows(db: D1Database, table: string): Promise<number> {
  const result = await db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).first()

  return (result as { cnt: number }).cnt
}

describe("AccountProvisioner.provisionWithEmployee", () => {
  test("employee / account / identity / account_role が全てアトミックに作成される", async () => {
    const { context, db } = createTestContext()
    const provisioner = new AccountProvisioner(context)

    const result = await provisioner.provisionWithEmployee({
      employee: {
        code: "E500",
        name: "Atomic User",
        deptId: null,
        deptName: null,
        position: null,
        status: "active",
      },
      email: "you+e500@example.com",
      passwordHash: "hashed-password",
      roleKey: "member",
      now: 1000,
    })

    expect(typeof result).toBe("number")

    // 各テーブルにレコードが存在することを確認
    const employee = await db.prepare("SELECT * FROM employees WHERE code = 'E500'").first()

    expect(employee).not.toBeNull()

    const account = await db
      .prepare("SELECT * FROM accounts WHERE employee_id = ?1")
      .bind((employee as { id: number }).id)
      .first()

    expect(account).not.toBeNull()

    const identity = await db
      .prepare("SELECT * FROM identities WHERE account_id = ?1")
      .bind((account as { id: number }).id)
      .first()

    expect(identity).not.toBeNull()
    expect((identity as { email: string }).email).toBe("you+e500@example.com")

    const accountRole = await db
      .prepare("SELECT * FROM account_roles WHERE account_id = ?1")
      .bind((account as { id: number }).id)
      .first()

    expect(accountRole).not.toBeNull()
  })

  test("employee code 重複時は全体が rollback される", async () => {
    const { context, db } = createTestContext()
    const provisioner = new AccountProvisioner(context)

    // 先に同じ code の employee を作っておく
    await db
      .prepare("INSERT INTO employees (code, name, status) VALUES ('E501', 'Existing', 'active')")
      .run()

    const beforeAccounts = await countRows(db, "accounts")

    const result = await provisioner.provisionWithEmployee({
      employee: {
        code: "E501",
        name: "Duplicate User",
        deptId: null,
        deptName: null,
        position: null,
        status: "active",
      },
      email: "you+e501@example.com",
      passwordHash: "hashed-password",
      roleKey: "member",
      now: 1000,
    })

    expect(result).toBeInstanceOf(Error)

    // account が増えていないこと（employee INSERT の失敗で batch 全体が rollback）
    const afterAccounts = await countRows(db, "accounts")

    expect(afterAccounts).toBe(beforeAccounts)
  })

  test("存在しない role key でも employee / account / identity は作成される", async () => {
    const { context, db } = createTestContext()
    const provisioner = new AccountProvisioner(context)

    const result = await provisioner.provisionWithEmployee({
      employee: {
        code: "E502",
        name: "No Role User",
        deptId: null,
        deptName: null,
        position: null,
        status: "active",
      },
      email: "you+e502@example.com",
      passwordHash: "hashed-password",
      roleKey: "nonexistent_role",
      now: 1000,
    })

    expect(typeof result).toBe("number")

    // employee / account / identity は存在する
    const employee = await db.prepare("SELECT * FROM employees WHERE code = 'E502'").first()

    expect(employee).not.toBeNull()

    const account = await db
      .prepare("SELECT * FROM accounts WHERE employee_id = ?1")
      .bind((employee as { id: number }).id)
      .first()

    expect(account).not.toBeNull()

    // account_roles は空（INSERT ... SELECT で role が見つからないので 0 行挿入）
    const accountRole = await db
      .prepare("SELECT * FROM account_roles WHERE account_id = ?1")
      .bind((account as { id: number }).id)
      .first()

    expect(accountRole).toBeNull()
  })
})
