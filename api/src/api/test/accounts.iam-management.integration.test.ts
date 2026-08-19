import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createTestToken } from "@/api/test/support/create-test-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"

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

/** E001 = admin、E005 = member。account.id = employee.id。 */
function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, { employeeId: 1, email: "you+e001@example.com", role: "root" })
}

function accountToken(accountId: number): Promise<string> {
  return createTestToken(jwtSecret, { employeeId: accountId, accountId: accountId })
}

/** 指定アカウントの system role を、必要最小限の permission だけを持つ動的ロールへ差し替える。 */
async function assignCustomRole(
  db: D1Database,
  accountId: number,
  roleKey: string,
  permissionKeys: ReadonlyArray<string>,
): Promise<number> {
  const roleId = 10_000 + accountId

  await db
    .prepare(
      `INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at)
       VALUES (?1, ?2, 'custom', ?3, 0, 0)`,
    )
    .bind(String(roleId), `company:${roleKey}`, roleKey)
    .run()

  for (const permissionKey of permissionKeys) {
    await db
      .prepare(
        `INSERT INTO system_iam_role_permissions (role_id, permission_key)
         VALUES (?1, ?2)`,
      )
      .bind(String(roleId), permissionKey)
      .run()
  }

  await db
    .prepare("DELETE FROM system_role_bindings WHERE account_id = ?1")
    .bind(String(accountId))
    .run()
  await db
    .prepare(
      `INSERT INTO system_role_bindings
         (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
       VALUES (?1, ?2, ?3, NULL, NULL, 0, NULL)`,
    )
    .bind(`test:${accountId}:${roleId}`, String(accountId), String(roleId))
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

/** ロールを作って id を得るヘルパ。 */
async function createAuditorRole(token: string, db: D1Database): Promise<number> {
  const response = await requestWithContext({
    db,
    jwtSecret,
    path: "/roles",
    token,
    method: "POST",
    // auditor はプリセットロール(0021_role_presets.sql)で seed 済みのため、テスト専用キーを使う。
    body: {
      key: "test_auditor",
      name: "監査(テスト)",
      description: null,
      permission_keys: ["dashboard:view"],
    },
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
      path: "/accounts/1/roles/root",
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
  test("admin の再設定はcredential・token失効・System監査を同時に永続化する", async () => {
    const db = await createTestDb()
    const before = await db
      .prepare(
        `SELECT credential.password_hash, account.token_version
         FROM system_identity_bindings AS identity
         INNER JOIN system_password_credentials AS credential ON credential.identity_id = identity.id
         INNER JOIN system_accounts AS account ON account.id = identity.account_id
         WHERE account.id = '5' AND identity.provider = 'password'`,
      )
      .first<{ password_hash: string; token_version: number }>()

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/accounts/5/reset-password",
      method: "POST",
      token: await adminToken(),
      body: { new_password: "Newsecret123" },
    })

    expect(response.status).toBe(204)
    const after = await db
      .prepare(
        `SELECT credential.password_hash, account.token_version
         FROM system_identity_bindings AS identity
         INNER JOIN system_password_credentials AS credential ON credential.identity_id = identity.id
         INNER JOIN system_accounts AS account ON account.id = identity.account_id
         WHERE account.id = '5' AND identity.provider = 'password'`,
      )
      .first<{ password_hash: string; token_version: number }>()
    expect(after?.password_hash).not.toBe(before?.password_hash)
    expect(after?.token_version).toBe((before?.token_version ?? 0) + 1)

    const audit = await db
      .prepare(
        "SELECT actor_account_id, action, target_type, target_id, outcome FROM system_audit_events WHERE action = 'iam.account.password_reset'",
      )
      .first<{
        actor_account_id: string
        action: string
        target_type: string
        target_id: string
        outcome: string
      }>()
    expect(audit).toEqual({
      actor_account_id: "1",
      action: "iam.account.password_reset",
      target_type: "account",
      target_id: "5",
      outcome: "succeeded",
    })
  })

  test("監査append失敗時はcredentialとtoken versionをrollbackする", async () => {
    const db = await createTestDb()
    const before = await db
      .prepare(
        `SELECT credential.password_hash, account.token_version
         FROM system_identity_bindings AS identity
         INNER JOIN system_password_credentials AS credential ON credential.identity_id = identity.id
         INNER JOIN system_accounts AS account ON account.id = identity.account_id
         WHERE account.id = '5' AND identity.provider = 'password'`,
      )
      .first<{ password_hash: string; token_version: number }>()
    await db
      .prepare(
        `CREATE TRIGGER force_password_reset_audit_failure
       BEFORE INSERT ON system_audit_events
       BEGIN
         SELECT RAISE(ABORT, 'forced audit failure');
       END`,
      )
      .run()

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/accounts/5/reset-password",
      method: "POST",
      token: await adminToken(),
      body: { new_password: "Newsecret123" },
    })

    expect(response.status).toBe(500)
    const after = await db
      .prepare(
        `SELECT credential.password_hash, account.token_version
         FROM system_identity_bindings AS identity
         INNER JOIN system_password_credentials AS credential ON credential.identity_id = identity.id
         INNER JOIN system_accounts AS account ON account.id = identity.account_id
         WHERE account.id = '5' AND identity.provider = 'password'`,
      )
      .first<{ password_hash: string; token_version: number }>()
    expect(after).toEqual(before)
    expect(
      await db.prepare("SELECT count(*) AS total FROM system_audit_events").first<number>("total"),
    ).toBe(0)
  })

  test("mutation途中でAccountが消える競合も部分更新を残さない", async () => {
    const db = await createTestDb()
    const before = await db
      .prepare(
        `SELECT credential.password_hash
         FROM system_identity_bindings AS identity
         INNER JOIN system_password_credentials AS credential ON credential.identity_id = identity.id
         WHERE identity.account_id = '5' AND identity.provider = 'password'`,
      )
      .first<{ password_hash: string }>()
    await db
      .prepare(
        `CREATE TRIGGER delete_account_during_password_reset
       BEFORE UPDATE OF password_hash ON system_password_credentials
       WHEN OLD.identity_id = 'password:5'
       BEGIN
         DELETE FROM system_accounts
         WHERE id = (SELECT account_id FROM system_identity_bindings WHERE id = OLD.identity_id);
       END`,
      )
      .run()

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/accounts/5/reset-password",
      method: "POST",
      token: await adminToken(),
      body: { new_password: "Newsecret123" },
    })

    expect(response.status).toBe(500)
    expect(
      await db
        .prepare(
          `SELECT credential.password_hash
           FROM system_identity_bindings AS identity
           INNER JOIN system_password_credentials AS credential ON credential.identity_id = identity.id
           WHERE identity.account_id = '5' AND identity.provider = 'password'`,
        )
        .first<{ password_hash: string }>(),
    ).toEqual(before)
    expect(
      await db
        .prepare("SELECT count(*) AS total FROM system_accounts WHERE id = 5")
        .first<number>("total"),
    ).toBe(1)
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
      .prepare("SELECT id FROM system_iam_roles WHERE key = 'company:manager'")
      .first<{ id: string }>()

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
    await db.prepare("DELETE FROM system_role_bindings WHERE account_id = '4'").run()

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
