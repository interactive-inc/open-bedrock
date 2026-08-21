import { InvalidSessionError } from "@system/domain/errors"
import { SessionEntity } from "@system/domain/entities/session.entity"
import { SessionRotationValue } from "@system/domain/values/auth/session-rotation.value"
import { zSessionFamilyId } from "@system/domain/schemas/auth/session-family-id.schema"
import { zSessionId } from "@system/domain/schemas/auth/session-id.schema"
import { zSessionTokenHash } from "@system/domain/schemas/auth/session-token-hash.schema"
import { describe, expect, test } from "bun:test"

const CREATED_AT = new Date("2026-08-11T00:00:00.000Z")
const ROTATED_AT = new Date("2026-08-11T00:30:00.000Z")
const EXPIRES_AT = new Date("2026-08-11T01:00:00.000Z")
const TOKEN_HASH = "a".repeat(64)
const SUCCESSOR_TOKEN_HASH = "b".repeat(64)

function sessionProps(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    id: "session-1",
    accountId: "account-1",
    familyId: "family-1",
    tokenHash: TOKEN_HASH,
    tokenVersion: 3,
    createdAt: CREATED_AT,
    expiresAt: EXPIRES_AT,
    rotatedAt: null,
    revokedAt: null,
    ...overrides,
  }
}

function requireSession(input: unknown): SessionEntity {
  const session = SessionEntity.create(input)
  expect(session).toBeInstanceOf(SessionEntity)
  if (session instanceof Error) throw session
  return session
}

describe("SessionEntity", () => {
  test("Accountとhash済みcredentialだけを保持しraw tokenや業務主体を持たない", () => {
    const session = requireSession(sessionProps())

    expect(session).toMatchObject({
      id: "session-1",
      accountId: "account-1",
      familyId: "family-1",
      tokenHash: TOKEN_HASH,
      tokenVersion: 3,
    })
    expect("token" in session).toBe(false)
    expect("employeeId" in session).toBe(false)
    expect("organizationId" in session).toBe(false)
    expect("permissions" in session).toBe(false)
    expect("transport" in session).toBe(false)
  })

  test("opaque IDとlowercase SHA-256 hashだけを受理する", () => {
    expect(String(zSessionId.parse("001"))).toBe("001")
    expect(String(zSessionFamilyId.parse("Family-A"))).toBe("Family-A")
    expect(String(zSessionTokenHash.parse(TOKEN_HASH))).toBe(TOKEN_HASH)

    for (const value of ["", "raw-refresh-token", "A".repeat(64), "a".repeat(63)]) {
      expect(zSessionTokenHash.safeParse(value).success).toBe(false)
    }
  })

  test("時点ごとのuse rejectionをclosed vocabularyで判定する", () => {
    const session = requireSession(sessionProps())

    expect(session.getUseRejection(new Date(CREATED_AT.getTime() - 1))).toBe("not_yet_valid")
    expect(session.getUseRejection(CREATED_AT)).toBeNull()
    expect(session.getUseRejection(new Date(EXPIRES_AT.getTime() - 1))).toBeNull()
    expect(session.getUseRejection(EXPIRES_AT)).toBe("expired")
    expect(session.getUseRejection(new Date(Number.NaN))).toBe("invalid_clock")
  })

  test("rotation replayをrotatedとして拒否しreuse検知へ渡す", () => {
    const session = requireSession(sessionProps())
    const rotated = session.rotate(ROTATED_AT)
    expect(rotated).toBeInstanceOf(SessionEntity)
    if (rotated instanceof Error) throw rotated

    expect(rotated.getUseRejection(new Date(ROTATED_AT.getTime() - 1))).toBeNull()
    expect(rotated.getUseRejection(ROTATED_AT)).toBe("rotated")
    expect(rotated.rotate(new Date(ROTATED_AT.getTime() + 1))).toEqual(
      expect.objectContaining({ reason: "rotated" }),
    )
  })

  test("family revocationはrotatedとexpiredを含め冪等に失効する", () => {
    const rotated = requireSession(sessionProps({ rotatedAt: ROTATED_AT }))
    const revokedAt = new Date(EXPIRES_AT.getTime() + 1)
    const revoked = rotated.revoke(revokedAt)
    expect(revoked).toBeInstanceOf(SessionEntity)
    if (revoked instanceof Error) throw revoked

    expect(revoked.getUseRejection(revokedAt)).toBe("revoked")
    expect(revoked.revoke(new Date(revokedAt.getTime() + 1))).toBe(revoked)
    expect(revoked.revoke(new Date(revokedAt.getTime() - 1))).toEqual(
      expect.objectContaining({ reason: "transition_before_last_update" }),
    )
  })

  test("入力とgetterのDateを変更してもlifecycleは変わらない", () => {
    const createdAt = new Date(CREATED_AT)
    const expiresAt = new Date(EXPIRES_AT)
    const session = requireSession(sessionProps({ createdAt, expiresAt }))

    createdAt.setUTCFullYear(2030)
    expiresAt.setUTCFullYear(2030)
    session.createdAt.setUTCFullYear(2031)
    session.expiresAt.setUTCFullYear(2031)

    expect(session.createdAt).toEqual(CREATED_AT)
    expect(session.expiresAt).toEqual(EXPIRES_AT)
    expect(Object.isFrozen(session)).toBe(true)
  })

  test.each([
    [sessionProps({ extra: true }), "invalid_shape"],
    [sessionProps({ accountId: "" }), "invalid_shape"],
    [sessionProps({ tokenHash: "raw-token" }), "invalid_shape"],
    [sessionProps({ tokenVersion: -1 }), "invalid_shape"],
    [sessionProps({ expiresAt: CREATED_AT }), "expiration_not_after_creation"],
    [sessionProps({ rotatedAt: new Date(CREATED_AT.getTime() - 1) }), "rotation_before_creation"],
    [sessionProps({ rotatedAt: EXPIRES_AT }), "rotation_at_or_after_expiration"],
    [sessionProps({ revokedAt: new Date(CREATED_AT.getTime() - 1) }), "revocation_before_creation"],
    [
      sessionProps({ rotatedAt: ROTATED_AT, revokedAt: new Date(ROTATED_AT.getTime() - 1) }),
      "revocation_before_rotation",
    ],
  ] as const)("不正なshapeとchronologyをfail closedで拒否する", (input, reason) => {
    const session = SessionEntity.create(input)

    expect(session).toBeInstanceOf(InvalidSessionError)
    expect(session instanceof InvalidSessionError ? session.reason : null).toBe(reason)
  })
})

describe("SessionRotationValue", () => {
  test("旧SessionEntityの消費と同じAccount familyの後継作成を一つの永続化意図にする", () => {
    const current = requireSession(sessionProps())
    const successor = requireSession(
      sessionProps({
        id: "session-2",
        tokenHash: SUCCESSOR_TOKEN_HASH,
        createdAt: ROTATED_AT,
        expiresAt: new Date(ROTATED_AT.getTime() + 3_600_000),
      }),
    )
    const rotation = SessionRotationValue.create(current, successor, ROTATED_AT)
    expect(rotation).toBeInstanceOf(SessionRotationValue)
    if (rotation instanceof Error) throw rotation

    expect(rotation.previous.getUseRejection(ROTATED_AT)).toBe("rotated")
    expect(rotation.successor.getUseRejection(ROTATED_AT)).toBeNull()
    expect(current.getUseRejection(ROTATED_AT)).toBeNull()
    expect(Object.isFrozen(rotation)).toBe(true)
  })

  test.each([
    { accountId: "account-2" },
    { familyId: "family-2" },
    { tokenVersion: 4 },
    { id: "session-1" },
    { tokenHash: TOKEN_HASH },
    { createdAt: new Date(ROTATED_AT.getTime() + 1) },
    { rotatedAt: ROTATED_AT },
    { revokedAt: ROTATED_AT },
  ])("不一致または使用済みの後継SessionEntityを拒否する", (overrides) => {
    const current = requireSession(sessionProps())
    const successor = requireSession(
      sessionProps({
        id: "session-2",
        tokenHash: SUCCESSOR_TOKEN_HASH,
        createdAt: ROTATED_AT,
        expiresAt: new Date(ROTATED_AT.getTime() + 3_600_000),
        ...overrides,
      }),
    )

    expect(SessionRotationValue.create(current, successor, ROTATED_AT)).toEqual(
      expect.objectContaining({ reason: "invalid_rotation_successor" }),
    )
  })
})
