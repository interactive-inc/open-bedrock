import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/bun-sqlite"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import { OidcAuthorizationCodeRepository } from "@/contexts/system/infrastructure/identity/oidc-authorization-code.repository"
import { OidcCryptographyService } from "@/contexts/system/infrastructure/identity/oidc-cryptography.service"
import { WriteOperationEntity } from "@/lib/persistence/write-operation.entity"
import type {
  SystemClockContext,
  SystemDatabaseContext,
} from "@system/infrastructure/configuration/system-context"
import * as schema from "@/contexts/system/infrastructure/schema/system-runtime"

const ISSUER = "https://identity.example.test"
const CLIENT_ID = "system-console"
const REDIRECT_URI = "https://console.example.test/api/auth/callback"
const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"

function createTestDb(): {
  database: DrizzleD1Database<typeof schema>
  sqlite: Database
} {
  const sqlite = new Database(":memory:")
  sqlite.run("PRAGMA foreign_keys = ON")
  sqlite.run(`
    CREATE TABLE users (
      id text PRIMARY KEY,
      name text NOT NULL,
      permissions_changed_at integer,
      disabled_at integer,
      created_at integer NOT NULL,
      updated_at integer NOT NULL
    )
  `)
  sqlite.run(`
    CREATE TABLE oidc_authorization_codes (
      code_hash text PRIMARY KEY,
      issuer text NOT NULL,
      client_id text NOT NULL,
      redirect_uri text NOT NULL,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_challenge text NOT NULL,
      nonce text NOT NULL,
      scope text NOT NULL,
      expires_at integer NOT NULL,
      created_at integer NOT NULL
    )
  `)
  const now = Date.now()
  sqlite.run(
    "INSERT INTO users (id, name, created_at, updated_at) VALUES ('user-1', 'Test User', ?, ?)",
    [now, now],
  )

  return {
    database: drizzle(sqlite, { schema }) as unknown as DrizzleD1Database<typeof schema>,
    sqlite,
  }
}

function repository(
  database: DrizzleD1Database<typeof schema>,
  now = new Date(),
): OidcAuthorizationCodeRepository {
  const context: SystemDatabaseContext & SystemClockContext = {
    var: { database, now: () => now },
  }
  return new OidcAuthorizationCodeRepository(context)
}

async function issueCode(
  database: DrizzleD1Database<typeof schema>,
  now = new Date(),
): Promise<string> {
  const result = await repository(database, now).write(
    WriteOperationEntity.create("create", {
      issuer: ISSUER,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      userId: "user-1",
      codeChallenge: await OidcCryptographyService.createPkceChallenge(VERIFIER),
      nonce: "nonce-with-enough-entropy",
      scope: ["openid", "profile", "email"],
    }),
  )

  if (result instanceof Error) {
    throw result
  }
  return result.code
}

function consumeInput(code: string) {
  return {
    issuer: ISSUER,
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
    code,
    verifier: VERIFIER,
  }
}

function consume(
  repository: OidcAuthorizationCodeRepository,
  props: ReturnType<typeof consumeInput>,
) {
  return repository.write(WriteOperationEntity.create("consume", props))
}

describe("OIDC authorization code", () => {
  test("正しいPKCE verifierで一度だけ消費できる", async () => {
    const fixture = createTestDb()
    const code = await issueCode(fixture.database)

    const first = await consume(repository(fixture.database), consumeInput(code))
    const replay = await consume(repository(fixture.database), consumeInput(code))

    expect(first).toEqual({
      userId: "user-1",
      nonce: "nonce-with-enough-entropy",
      scope: "openid profile email",
    })
    expect(replay).toBeNull()
    fixture.sqlite.close()
  })

  test("誤ったverifier・issuer・redirect URIでは消費しない", async () => {
    const fixture = createTestDb()
    const code = await issueCode(fixture.database)

    expect(
      await consume(repository(fixture.database), {
        ...consumeInput(code),
        verifier: `${VERIFIER.slice(0, -1)}A`,
      }),
    ).toBeNull()
    expect(
      await consume(repository(fixture.database), {
        ...consumeInput(code),
        issuer: "https://secondary.identity.example.test",
      }),
    ).toBeNull()
    expect(
      await consume(repository(fixture.database), {
        ...consumeInput(code),
        redirectUri: "https://attacker.example/callback",
      }),
    ).toBeNull()

    expect(await consume(repository(fixture.database), consumeInput(code))).not.toBeNull()
    fixture.sqlite.close()
  })

  test("期限切れcodeは消費できない", async () => {
    const fixture = createTestDb()
    const issuedAt = new Date("2026-07-29T00:00:00.000Z")
    const code = await issueCode(fixture.database, issuedAt)

    const result = await consume(
      repository(fixture.database, new Date("2026-07-29T00:02:01.000Z")),
      consumeInput(code),
    )

    expect(result).toBeNull()
    fixture.sqlite.close()
  })

  test("並行交換しても成功は一件だけ", async () => {
    const fixture = createTestDb()
    const code = await issueCode(fixture.database)

    const results = await Promise.all(
      Array.from({ length: 8 }, () => consume(repository(fixture.database), consumeInput(code))),
    )

    expect(results.filter((result) => result !== null && !(result instanceof Error))).toHaveLength(
      1,
    )
    fixture.sqlite.close()
  })
})
