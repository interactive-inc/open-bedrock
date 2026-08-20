import { OidcHttpError } from "@system/interface/errors"
import { describe, expect, test } from "bun:test"
import { HTTPException } from "hono/http-exception"

describe("OidcHttpError", () => {
  test("Responseを持たないHTTPException派生にする", () => {
    const error = new OidcHttpError({ code: "invalid_token", status: 401 })

    expect(error).toBeInstanceOf(HTTPException)
    expect(error.status).toBe(401)
    expect(error.code).toBe("invalid_token")
    expect(error.res).toBeUndefined()
  })
})
