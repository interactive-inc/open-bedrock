import { describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import type { SystemDatabaseContext } from "@system/infrastructure/configuration/system-context"
import { IamIdentityEntity } from "@/contexts/system/domain/identity/iam-identity.entity"
import type { IdentityProvider } from "@/contexts/system/domain/identity/identity-provider"
import { WriteOperationEntity } from "@/lib/persistence/write-operation.entity"
import { IamIdentityWriteError } from "@/contexts/system/infrastructure/iam/errors"
import { IamIdentityRepository } from "@/contexts/system/infrastructure/iam/iam-identity.repository"
import * as schema from "@/contexts/system/infrastructure/schema/system-runtime"

type TestDatabase = Readonly<{
  database: DrizzleD1Database<typeof schema>
  sqlite: Database
}>

function createTestDatabase(): TestDatabase {
  const sqlite = new Database(":memory:")

  sqlite.run(`
    CREATE TABLE user_identities (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      provider text NOT NULL,
      provider_subject text NOT NULL,
      email text,
      password_hash text,
      can_receive_email integer NOT NULL DEFAULT 1,
      email_verified_at integer,
      password_changed_at integer,
      created_at integer NOT NULL,
      updated_at integer NOT NULL
    )
  `)

  return {
    database: drizzle(sqlite, { schema }) as unknown as DrizzleD1Database<typeof schema>,
    sqlite,
  }
}

function createIdentity(props: {
  id: string
  userId?: string
  provider?: IdentityProvider
  passwordHash?: string | null
}): IamIdentityEntity {
  const provider = props.provider ?? "password"
  const email = `${props.id}@example.test`
  const now = new Date("2026-08-05T00:00:00.000Z")

  return new IamIdentityEntity({
    id: props.id,
    userId: props.userId ?? "user-1",
    provider,
    providerSubject: provider === "password" ? email : props.id,
    email,
    passwordHash: props.passwordHash === undefined ? "configured-hash" : props.passwordHash,
    canReceiveEmail: true,
    emailVerifiedAt: now,
    passwordChangedAt: now,
    createdAt: now,
    updatedAt: now,
  })
}

function insertIdentity(sqlite: Database, identity: IamIdentityEntity): void {
  sqlite.run(
    `INSERT INTO user_identities (
      id, user_id, provider, provider_subject, email, password_hash, can_receive_email,
      email_verified_at, password_changed_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      identity.id,
      identity.userId,
      identity.provider,
      identity.providerSubject,
      identity.email,
      identity.passwordHash,
      identity.canReceiveEmail ? 1 : 0,
      identity.emailVerifiedAt?.getTime() ?? null,
      identity.passwordChangedAt?.getTime() ?? null,
      identity.createdAt.getTime(),
      identity.updatedAt.getTime(),
    ],
  )
}

function createRepository(database: DrizzleD1Database<typeof schema>): IamIdentityRepository {
  const context: SystemDatabaseContext = { var: { database } }
  return new IamIdentityRepository(context)
}

async function writeIdentityDeletion(repository: IamIdentityRepository, entity: IamIdentityEntity) {
  const deletionEntity = WriteOperationEntity.create("delete", { entity })

  return repository.write(deletionEntity)
}

function identityCount(sqlite: Database, userId = "user-1"): number {
  const row = sqlite
    .query("SELECT COUNT(*) AS count FROM user_identities WHERE user_id = ?")
    .get(userId) as { count: number }

  return row.count
}

describe("IamIdentityRepository.write deletion Entity", () => {
  test("唯一の設定済みログイン方法は削除せず false を返す", async () => {
    const { database, sqlite } = createTestDatabase()
    const onlyIdentity = createIdentity({ id: "identity-only" })
    insertIdentity(sqlite, onlyIdentity)

    const writeResult = await writeIdentityDeletion(createRepository(database), onlyIdentity)

    expect(writeResult).toBe(false)
    expect(identityCount(sqlite)).toBe(1)
  })

  test("パスワード未設定 identity は残存ログイン方法として数えない", async () => {
    const { database, sqlite } = createTestDatabase()
    const configured = createIdentity({ id: "identity-configured" })
    const pending = createIdentity({ id: "identity-pending", passwordHash: null })
    insertIdentity(sqlite, configured)
    insertIdentity(sqlite, pending)

    const writeResult = await writeIdentityDeletion(createRepository(database), configured)

    expect(writeResult).toBe(false)
    expect(identityCount(sqlite)).toBe(2)
  })

  test("別の設定済みログイン方法があれば削除して true を返す", async () => {
    const { database, sqlite } = createTestDatabase()
    const target = createIdentity({ id: "identity-target" })
    const remaining = createIdentity({ id: "identity-remaining" })
    insertIdentity(sqlite, target)
    insertIdentity(sqlite, remaining)

    const writeResult = await writeIdentityDeletion(createRepository(database), target)

    expect(writeResult).toBe(true)
    expect(identityCount(sqlite)).toBe(1)
  })

  test("password 以外の identity は password_hash が無くても設定済みとして数える", async () => {
    const { database, sqlite } = createTestDatabase()
    const target = createIdentity({ id: "identity-password" })
    const oidc = createIdentity({ id: "identity-oidc", provider: "oidc", passwordHash: null })
    insertIdentity(sqlite, target)
    insertIdentity(sqlite, oidc)

    const writeResult = await writeIdentityDeletion(createRepository(database), target)

    expect(writeResult).toBe(true)
    expect(identityCount(sqlite)).toBe(1)
  })

  test("逐次に 2 件を削除しても 2 件目を拒否して設定済みログインを 1 件残す", async () => {
    const { database, sqlite } = createTestDatabase()
    const firstIdentity = createIdentity({ id: "identity-first" })
    const secondIdentity = createIdentity({ id: "identity-second" })
    insertIdentity(sqlite, firstIdentity)
    insertIdentity(sqlite, secondIdentity)
    const repository = createRepository(database)

    const firstWriteResult = await writeIdentityDeletion(repository, firstIdentity)
    const secondWriteResult = await writeIdentityDeletion(repository, secondIdentity)

    expect(firstWriteResult).toBe(true)
    expect(secondWriteResult).toBe(false)
    expect(identityCount(sqlite)).toBe(1)
  })

  test("2 client が同時に削除を開始しても書き込み時の条件で片方だけを削除する", async () => {
    const { database, sqlite } = createTestDatabase()
    const firstIdentity = createIdentity({ id: "identity-client-a" })
    const secondIdentity = createIdentity({ id: "identity-client-b" })
    insertIdentity(sqlite, firstIdentity)
    insertIdentity(sqlite, secondIdentity)
    const repository = createRepository(database)

    const results = await Promise.all([
      writeIdentityDeletion(repository, firstIdentity),
      writeIdentityDeletion(repository, secondIdentity),
    ])

    expect(results.filter((result) => result === true)).toHaveLength(1)
    expect(results.filter((result) => result === false)).toHaveLength(1)
    expect(identityCount(sqlite)).toBe(1)
  })

  test("別 client が対象を削除済みなら true を返す", async () => {
    const { database, sqlite } = createTestDatabase()
    const disappeared = createIdentity({ id: "identity-disappeared" })

    const writeResult = await writeIdentityDeletion(createRepository(database), disappeared)

    expect(writeResult).toBe(true)
    expect(identityCount(sqlite)).toBe(0)
  })

  test("DB エラーは IamIdentityWriteError として返す", async () => {
    const { database, sqlite } = createTestDatabase()
    const identity = createIdentity({ id: "identity-db-error" })
    insertIdentity(sqlite, identity)
    sqlite.run("DROP TABLE user_identities")

    const writeResult = await writeIdentityDeletion(createRepository(database), identity)

    expect(writeResult).toBeInstanceOf(IamIdentityWriteError)
  })
})
