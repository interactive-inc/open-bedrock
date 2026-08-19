import { describe, expect, test } from "bun:test"
import { OidcResponse } from "@/contexts/system/interface/http/oidc-response"

describe("OidcResponse", () => {
  test("OAuth応答をno-storeにし、エラーコードをJSONで返す", async () => {
    const response = OidcResponse.error("invalid_grant", 400)

    expect(response.status).toBe(400)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("pragma")).toBe("no-cache")
    expect(await response.json()).toEqual({ error: "invalid_grant" })
  })
})
