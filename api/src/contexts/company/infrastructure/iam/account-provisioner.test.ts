import { AccountProvisioner } from "@/contexts/company/infrastructure/iam/account-provisioner"
import { createTestContext } from "@/api/test/support/create-test-context"
import { replaceAccountRolesWithPermissionSets } from "@/api/test/support/replace-account-roles-with-permission-sets"
import { seedIamTestAccount } from "@/api/test/support/seed-iam-test-account"
import { describe, expect, test } from "bun:test"

async function countRows(db: D1Database, table: string): Promise<number> {
  const result = await db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).first()

  return (result as { cnt: number }).cnt
}

describe("AccountProvisioner.provisionWithEmployee", () => {
  test("employee / account / identity / account_role が全てアトミックに作成される", async () => {
    const { context, db } = createTestContext()
    const provisioner = new AccountProvisioner(context)
    const actorAccountId = await seedIamTestAccount(context, "E499", "root")

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
      passwordHash: "hashed-password-material",
      roleKey: "member",
      grantedByAccountId: actorAccountId,
      now: 1000,
    })

    expect(typeof result).toBe("number")

    // 各テーブルにレコードが存在することを確認
    const employee = await db.prepare("SELECT * FROM employees WHERE code = 'E500'").first()

    expect(employee).not.toBeNull()

    const account = await db
      .prepare(
        "SELECT account.* FROM system_accounts account JOIN account_employee_links link ON link.account_id = account.id WHERE link.employee_id = ?1",
      )
      .bind((employee as { id: number }).id)
      .first()

    expect(account).not.toBeNull()

    const identity = await db
      .prepare(
        `SELECT profile.email
         FROM system_identity_bindings AS identity
         INNER JOIN system_identity_profiles AS profile ON profile.identity_id = identity.id
         WHERE identity.account_id = ?1`,
      )
      .bind(String((account as { id: number }).id))
      .first()

    expect(identity).not.toBeNull()
    expect((identity as { email: string }).email).toBe("you+e500@example.com")

    const accountRole = await db
      .prepare("SELECT * FROM system_role_bindings WHERE account_id = ?1 AND revoked_at IS NULL")
      .bind(String((account as { id: number }).id))
      .first()

    expect(accountRole).not.toBeNull()
  })

  test("employee code 重複時は全体が rollback される", async () => {
    const { context, db } = createTestContext()
    const provisioner = new AccountProvisioner(context)
    const actorAccountId = await seedIamTestAccount(context, "E498", "root")

    // 先に同じ code の employee を作っておく
    await db
      .prepare("INSERT INTO employees (code, name, status) VALUES ('E501', 'Existing', 'active')")
      .run()

    const beforeAccounts = await countRows(db, "system_accounts")

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
      passwordHash: "hashed-password-material",
      roleKey: "member",
      grantedByAccountId: actorAccountId,
      now: 1000,
    })

    expect(result).toBeInstanceOf(Error)

    // account が増えていないこと（employee INSERT の失敗で batch 全体が rollback）
    const afterAccounts = await countRows(db, "system_accounts")

    expect(afterAccounts).toBe(beforeAccounts)
  })

  test("存在しない role key では全体が rollback される", async () => {
    const { context, db } = createTestContext()
    const provisioner = new AccountProvisioner(context)
    const actorAccountId = await seedIamTestAccount(context, "E497", "root")

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
      passwordHash: "hashed-password-material",
      roleKey: "nonexistent_role",
      grantedByAccountId: actorAccountId,
      now: 1000,
    })

    expect(result).toBeInstanceOf(Error)

    const employee = await db.prepare("SELECT * FROM employees WHERE code = 'E502'").first()

    expect(employee).toBeNull()
  })

  test("付与者が持たない権限を含む role では全体が rollback される", async () => {
    const { context, db } = createTestContext()
    const provisioner = new AccountProvisioner(context)
    const actorAccountId = await seedIamTestAccount(context, "E496")

    await replaceAccountRolesWithPermissionSets(context, actorAccountId, "employee-provisioner", [
      ["employee:create", "employee:assign_role"],
    ])

    const result = await provisioner.provisionWithEmployee({
      employee: {
        code: "E503",
        name: "Escalated User",
        deptId: null,
        deptName: null,
        position: null,
        status: "active",
      },
      email: "you+e503@example.com",
      passwordHash: "hashed-password-material",
      roleKey: "root",
      grantedByAccountId: actorAccountId,
      now: 1000,
    })

    expect(result).toBeInstanceOf(Error)

    expect(await db.prepare("SELECT * FROM employees WHERE code = 'E503'").first()).toBeNull()
    expect(
      await db
        .prepare("SELECT * FROM system_identity_profiles WHERE email = ?1")
        .bind("you+e503@example.com")
        .first(),
    ).toBeNull()
  })
})
