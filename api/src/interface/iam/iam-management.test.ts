import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"

const jwtSecret = "iam-management-test-secret"

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "employees",
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      dept_id: employee.deptId,
      dept_name: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

  await seedIamForEmployees(db)

  return db
}

// E001 = admin、E005 = member。account.id = employee.id。
function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, { employeeId: 1, email: "you+e001@example.com", role: "admin" })
}

function accountToken(accountId: number): Promise<string> {
  return createTestToken(jwtSecret, { employeeId: accountId, accountId: accountId })
}

// 指定アカウントの system role を、必要最小限の permission だけを持つ動的ロールへ差し替える。
async function assignCustomRole(
  db: D1Database,
  accountId: number,
  roleKey: string,
  permissionKeys: ReadonlyArray<string>,
): Promise<number> {
  const inserted = await db
    .prepare("INSERT INTO roles (key, name, is_system, created_at) VALUES (?1, ?1, 0, 0)")
    .bind(roleKey)
    .run()

  const roleId = inserted.meta.last_row_id

  for (const permissionKey of permissionKeys) {
    await db
      .prepare(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT ?1, id FROM permissions WHERE key = ?2`,
      )
      .bind(roleId, permissionKey)
      .run()
  }

  await db.prepare("DELETE FROM account_roles WHERE account_id = ?1").bind(accountId).run()
  await db
    .prepare(
      "INSERT INTO account_roles (account_id, role_id, granted_by, granted_at) VALUES (?1, ?2, NULL, 0)",
    )
    .bind(accountId, roleId)
    .run()

  return roleId
}

async function request(props: {
  path: string
  method?: string
  token: string | null
  body?: unknown
}): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: props.path,
    token: props.token,
    method: props.method,
    body: props.body,
  })
}

// ロールを作って id を得るヘルパ。
async function createAuditorRole(token: string, db: D1Database): Promise<number> {
  const response = await requestWithContext({
    db,
    jwtSecret,
    path: "/roles",
    token,
    method: "POST",
    body: { key: "auditor", name: "監査", description: null, permission_keys: ["dashboard:view"] },
  })

  const body = (await response.json()) as { id: number }

  return body.id
}

describe("DELETE /accounts/:id/roles/:roleKey (ロール剥奪)", () => {
  test("admin が member アカウントからロールを剥奪できる", async () => {
    const db = await createTestDb()

    await requestWithContext({
      db,
      jwtSecret,
      path: "/accounts/5/roles",
      token: await adminToken(),
      method: "POST",
      body: { role_key: "manager" },
    })

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/accounts/5/roles/manager",
      token: await adminToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("最後の admin は剥奪できない (last_admin)", async () => {
    const response = await request({
      path: "/accounts/1/roles/admin",
      method: "DELETE",
      token: await adminToken(),
    })

    expect(response.status).toBe(409)
  })

  test("iam:assign_roles だけでは自分より高権限のロールを剥奪できない", async () => {
    const db = await createTestDb()

    await assignCustomRole(db, 5, "role-operator", ["iam:assign_roles"])

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/accounts/2/roles/manager",
      token: await accountToken(5),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })
})

describe("POST /accounts/:id/reset-password (パスワード再設定)", () => {
  test("admin が member アカウントのパスワードを再設定できる", async () => {
    const response = await request({
      path: "/accounts/5/reset-password",
      method: "POST",
      token: await adminToken(),
      body: { new_password: "Newsecret123" },
    })

    expect(response.status).toBe(204)
  })

  test("短すぎるパスワードは弾く (weak_password)", async () => {
    const response = await request({
      path: "/accounts/5/reset-password",
      method: "POST",
      token: await adminToken(),
      body: { new_password: "short" },
    })

    expect(response.status).toBe(400)
  })

  test("account:manage だけでは高権限アカウントのパスワードを再設定できない", async () => {
    const db = await createTestDb()

    await assignCustomRole(db, 5, "account-operator", [
      "account:manage",
      "governance:read",
      "governance:acknowledge",
    ])

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/accounts/1/reset-password",
      token: await accountToken(5),
      method: "POST",
      body: { new_password: "Newsecret123" },
    })

    expect(response.status).toBe(403)
  })

  test("account:manage で権限を持たない member のパスワードは再設定できる", async () => {
    const db = await createTestDb()

    await assignCustomRole(db, 5, "account-operator", [
      "account:manage",
      "governance:read",
      "governance:acknowledge",
    ])

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/accounts/3/reset-password",
      token: await accountToken(5),
      method: "POST",
      body: { new_password: "Newsecret123" },
    })

    expect(response.status).toBe(204)
  })
})

describe("POST /accounts/:id/status (停止)", () => {
  test("admin が member アカウントを停止できる", async () => {
    const response = await request({
      path: "/accounts/5/status",
      method: "POST",
      token: await adminToken(),
      body: { status: "suspended" },
    })

    expect(response.status).toBe(204)
  })

  test("自分自身は停止できない (self_deactivation)", async () => {
    const response = await request({
      path: "/accounts/1/status",
      method: "POST",
      token: await adminToken(),
      body: { status: "suspended" },
    })

    expect(response.status).toBe(403)
  })

  test("account:manage だけでは高権限アカウントを停止できない", async () => {
    const db = await createTestDb()

    await assignCustomRole(db, 5, "account-operator", ["account:manage"])

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/accounts/1/status",
      token: await accountToken(5),
      method: "POST",
      body: { status: "suspended" },
    })

    expect(response.status).toBe(403)
  })
})

describe("ロール作成", () => {
  test("作成したロールに permission が永続化される (GET で読み戻して確認)", async () => {
    const db = await createTestDb()

    const roleId = await createAuditorRole(await adminToken(), db)

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: `/roles/${roleId}`,
      token: await adminToken(),
    })

    const body = (await response.json()) as { permission_keys: ReadonlyArray<string> }

    expect(response.status).toBe(200)
    expect(body.permission_keys).toContain("dashboard:view")
  })
})

describe("ロール編集・削除", () => {
  test("動的ロールを更新できる (PATCH)", async () => {
    const db = await createTestDb()

    const roleId = await createAuditorRole(await adminToken(), db)

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: `/roles/${roleId}`,
      token: await adminToken(),
      method: "PATCH",
      body: { name: "監査(更新)", description: "desc", permission_keys: ["dashboard:view"] },
    })

    expect(response.status).toBe(204)
  })

  test("system role は削除できない (system_role)", async () => {
    const db = await createTestDb()

    // member role の id を取得して削除を試みる。
    const list = await requestWithContext({
      db,
      jwtSecret,
      path: "/roles",
      token: await adminToken(),
    })

    const body = (await list.json()) as { data: ReadonlyArray<{ id: number; key: string }> }

    const memberRole = body.data.find((role) => role.key === "member")

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: `/roles/${memberRole?.id}`,
      token: await adminToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(409)
  })

  test("未割当の動的ロールは削除できる", async () => {
    const db = await createTestDb()

    const roleId = await createAuditorRole(await adminToken(), db)

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: `/roles/${roleId}`,
      token: await adminToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("iam:manage_roles だけでは高権限ロールを空に変更できない", async () => {
    const db = await createTestDb()

    await assignCustomRole(db, 5, "role-editor", ["iam:manage_roles"])

    const manager = await db
      .prepare("SELECT id FROM roles WHERE key = 'manager'")
      .first<{ id: number }>()

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: `/roles/${manager?.id}`,
      token: await accountToken(5),
      method: "PATCH",
      body: { name: "Manager", description: null, permission_keys: [] },
    })

    expect(response.status).toBe(403)
  })

  test("iam:manage_roles だけでは自分が持たない権限の動的ロールを削除できない", async () => {
    const db = await createTestDb()

    await assignCustomRole(db, 5, "role-editor", ["iam:manage_roles"])

    const protectedRoleId = await assignCustomRole(db, 4, "protected-role", ["dashboard:view"])

    // 削除可否だけを検証するため、対象ロールを未割当に戻す。
    await db.prepare("DELETE FROM account_roles WHERE account_id = 4").run()

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: `/roles/${protectedRoleId}`,
      token: await accountToken(5),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })
})
