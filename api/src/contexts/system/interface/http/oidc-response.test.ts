import { describe, expect, test } from "bun:test"
import { OidcHttpError } from "@/contexts/system/interface/http/oidc-http-error"
import { OidcResponse } from "@/contexts/system/interface/http/oidc-response"
import { HTTPException } from "hono/http-exception"

describe("OidcResponse", () => {
  test("OAuth成功応答をno-storeにする", async () => {
    const response = OidcResponse.json({ access_token: "token" })

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("pragma")).toBe("no-cache")
    expect(await response.json()).toEqual({ access_token: "token" })
  })

  test("OAuth失敗はResponseを持たないHTTPException派生にする", () => {
    const error = new OidcHttpError({ code: "invalid_token", status: 401 })

    expect(error).toBeInstanceOf(HTTPException)
    expect(error.status).toBe(401)
    expect(error.code).toBe("invalid_token")
    expect(error.res).toBeUndefined()
  })
})
