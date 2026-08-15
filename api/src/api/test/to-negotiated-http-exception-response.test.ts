import { describe, expect, test } from "bun:test"
import { toNegotiatedHttpExceptionResponse } from "@/api/to-negotiated-http-exception-response"
import { HTTPException } from "hono/http-exception"

function errorWithBody(body: unknown, status: 404 | 422 = 404): HTTPException {
  return new HTTPException(status, {
    res: new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", vary: "Origin" },
    }),
  })
}

describe("toNegotiatedHttpExceptionResponse", () => {
  test("adapts a typed Hono error to the System response input", async () => {
    const response = await toNegotiatedHttpExceptionResponse({
      error: errorWithBody({ error: "account not found", code: "account_not_found" }),
      accept: "application/problem+json",
    })

    expect(response?.status).toBe(404)
    expect(response?.headers.get("content-type")).toBe("application/problem+json")
    expect(response?.headers.get("vary")).toBe("Origin, Accept")
    expect(await response?.json()).toEqual({
      type: "/problems/account_not_found",
      title: "Not Found",
      status: 404,
      detail: "account not found",
      code: "account_not_found",
    })
  })

  test("leaves non-opt-in and untyped Hono errors untouched", async () => {
    const error = errorWithBody({ error: "not found", code: "not_found" })

    expect(await toNegotiatedHttpExceptionResponse({ error, accept: null })).toBeNull()
    expect(
      await toNegotiatedHttpExceptionResponse({
        error: new HTTPException(404),
        accept: "application/problem+json",
      }),
    ).toBeNull()
  })

  test("fails closed when the legacy response does not expose code and detail", async () => {
    const errors = [
      errorWithBody(null),
      errorWithBody([]),
      errorWithBody({ error: "not found" }),
      errorWithBody({ code: "not_found" }),
    ]

    for (const error of errors) {
      expect(
        await toNegotiatedHttpExceptionResponse({
          error,
          accept: "application/problem+json",
        }),
      ).toBeNull()
    }
  })
})
