import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/bun-sqlite"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import { WriteOperationEntity } from "@/lib/persistence/write-operation.entity"
import { OidcAccessTokenRepository } from "@/contexts/system/infrastructure/identity/oidc-access-token.repository"
import type {
  SystemClockContext,
  SystemDatabaseContext,
} from "@system/infrastructure/configuration/system-context"
import * as schema from "@/contexts/system/infrastructure/schema/system-runtime"

const ISSUER = "https://identity.example.test"

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
      created_at integer NOT NULL,
      updated_at integer NOT NULL
    )
  `)
  sqlite.run(`
    CREATE TABLE oidc_access_tokens (
      token_hash text PRIMARY KEY,
      issuer text NOT NULL,
      client_id text NOT NULL,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      scope text NOT NULL,
      expires_at integer NOT NULL,
      created_at integer NOT NULL
    )
  `)
  sqlite.run(
    "INSERT INTO users (id, name, created_at, updated_at) VALUES ('user-1', 'Test User', 0, 0)",
  )

  return {
    database: drizzle(sqlite, { schema }) as unknown as DrizzleD1Database<typeof schema>,
    sqlite,
  }
}

function repository(
  database: DrizzleD1Database<typeof schema>,
  now: Date,
): OidcAccessTokenRepository {
  const context: SystemDatabaseContext & SystemClockContext = {
    var: { database, now: () => now },
  }
  return new OidcAccessTokenRepository(context)
}

describe("OIDC access token", () => {
  test("issuerに束縛し、5分経過後は解決しない", async () => {
    const fixture = createTestDb()
    const issuedAt = new Date("2026-07-29T00:00:00.000Z")
    const writeResult = await repository(fixture.database, issuedAt).write(
      WriteOperationEntity.create("create", {
        issuer: ISSUER,
        clientId: "system-console",
        userId: "user-1",
        scope: "openid profile email",
      }),
    )
    if (writeResult instanceof Error) {
      throw writeResult
    }

    expect(
      await repository(fixture.database, new Date("2026-07-29T00:04:59.999Z")).find({
        issuer: "https://secondary.identity.example.test",
        accessToken: writeResult.accessToken,
      }),
    ).toBeNull()
    expect(
      await repository(fixture.database, new Date("2026-07-29T00:04:59.999Z")).find({
        issuer: ISSUER,
        accessToken: writeResult.accessToken,
      }),
    ).toEqual({
      clientId: "system-console",
      userId: "user-1",
      scope: "openid profile email",
    })
    expect(
      await repository(fixture.database, new Date("2026-07-29T00:05:00.000Z")).find({
        issuer: ISSUER,
        accessToken: writeResult.accessToken,
      }),
    ).toBeNull()

    fixture.sqlite.close()
  })

  test("D1にはaccess tokenの平文を保存しない", async () => {
    const fixture = createTestDb()
    const writeResult = await repository(fixture.database, new Date()).write(
      WriteOperationEntity.create("create", {
        issuer: ISSUER,
        clientId: "system-console",
        userId: "user-1",
        scope: "openid",
      }),
    )
    if (writeResult instanceof Error) {
      throw writeResult
    }

    const stored = fixture.sqlite.query("SELECT token_hash FROM oidc_access_tokens").get() as {
      token_hash: string
    }
    expect(stored.token_hash).not.toBe(writeResult.accessToken)
    expect(stored.token_hash).toMatch(/^[a-f0-9]{64}$/)

    fixture.sqlite.close()
  })
})
