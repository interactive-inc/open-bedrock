import { parseBearerAuthorization } from "@system/domain/auth/parse-bearer-authorization"
import { describe, expect, test } from "bun:test"

describe("parseBearerAuthorization", () => {
  test.each([
    ["Bearer abc.def_ghi-123", "abc.def_ghi-123"],
    ["bearer token", "token"],
    ["BEARER\ttoken", "token"],
    ["Bearer  token", "token"],
  ])("extracts one token from a case-insensitive Bearer scheme: %p", (header, token) => {
    const authorization = parseBearerAuthorization(header)

    expect(authorization).toEqual({ kind: "token", token })
    expect(Object.isFrozen(authorization)).toBe(true)
  })

  test.each([undefined, "Basic token", "BearerX token"])(
    "keeps a non-Bearer authorization absent: %p",
    (header) => {
      expect(parseBearerAuthorization(header)).toEqual({ kind: "absent" })
    },
  )

  test.each(["Bearer", "Bearer ", "Bearer token extra", "Bearer\ntoken", "Bearer token\tmore"])(
    "fails closed for a malformed Bearer authorization: %p",
    (header) => {
      expect(parseBearerAuthorization(header)).toEqual({ kind: "malformed" })
    },
  )
})
