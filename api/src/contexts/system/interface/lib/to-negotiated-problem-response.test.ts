import { describe, expect, test } from "bun:test"
import { HTTPException } from "hono/http-exception"
import { NotFoundError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { toNegotiatedProblemResponse } from "@/contexts/system/interface/lib/to-negotiated-problem-response"

describe("toNegotiatedProblemResponse", () => {
  test("returns Problem Details only for an explicit opt-in", async () => {
    const error = toHttpException(new NotFoundError("account not found", "account_not_found"))
    const response = await toNegotiatedProblemResponse({
      error,
      accept: "application/problem+json",
    })

    expect(response?.status).toBe(404)
    expect(response?.headers.get("content-type")).toBe("application/problem+json")
    expect(response?.headers.get("vary")).toBe("Accept")
    expect(await response?.json()).toEqual({
      type: "/problems/account_not_found",
      title: "Not Found",
      status: 404,
      detail: "account not found",
      code: "account_not_found",
    })
  })

  test("leaves legacy and explicitly rejected requests untouched", async () => {
    const error = toHttpException(new NotFoundError("account not found", "account_not_found"))

    expect(await toNegotiatedProblemResponse({ error, accept: null })).toBeNull()
    expect(
      await toNegotiatedProblemResponse({ error, accept: "application/problem+json; q=0" }),
    ).toBeNull()
    expect(await toNegotiatedProblemResponse({ error, accept: "*/*" })).toBeNull()
  })

  test("keeps safe public extensions without allowing reserved member spoofing", async () => {
    const error = new HTTPException(422, {
      res: new Response(
        JSON.stringify({
          error: "invalid request",
          code: "invalid_request",
          type: "https://attacker.example/problem",
          status: 200,
          cause: "database credentials",
          issues: [{ path: ["name"], message: "required" }],
        }),
        { status: 422, headers: { "content-type": "application/json" } },
      ),
    })

    const response = await toNegotiatedProblemResponse({
      error,
      accept: "application/problem+json",
    })

    expect(await response?.json()).toEqual({
      type: "/problems/invalid_request",
      title: "Unprocessable Content",
      status: 422,
      detail: "invalid request",
      code: "invalid_request",
      issues: [{ path: ["name"], message: "required" }],
    })
  })

  test("preserves existing response variance", async () => {
    const error = new HTTPException(404, {
      res: new Response(JSON.stringify({ error: "not found", code: "not_found" }), {
        status: 404,
        headers: { "content-type": "application/json", vary: "Origin" },
      }),
    })

    const response = await toNegotiatedProblemResponse({
      error,
      accept: "application/problem+json",
    })

    expect(response?.headers.get("vary")).toBe("Origin, Accept")
  })
})
