import { describe, expect, test } from "bun:test"
import { toHttpException } from "@/interface/lib/to-http-exception"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  PayloadTooLargeError,
  UnavailableError,
  UnexpectedError,
  UnprocessableError,
  ValidationError,
} from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

describe("toHttpException", () => {
  type ExpectedStatus = 400 | 403 | 404 | 409 | 413 | 422 | 500 | 503

  const cause = new Error("database details must remain private")
  const cases: ReadonlyArray<{
    name: string
    error: ApplicationError
    status: ExpectedStatus
    code: string
  }> = [
    {
      name: "validation",
      error: new ValidationError("invalid input", "invalid_input", { cause }),
      status: 400,
      code: "invalid_input",
    },
    {
      name: "forbidden",
      error: new ForbiddenError("forbidden", "forbidden", { cause }),
      status: 403,
      code: "forbidden",
    },
    {
      name: "not found",
      error: new NotFoundError("not found", "not_found", { cause }),
      status: 404,
      code: "not_found",
    },
    {
      name: "conflict",
      error: new ConflictError("conflict", "conflict", { cause }),
      status: 409,
      code: "conflict",
    },
    {
      name: "payload too large",
      error: new PayloadTooLargeError("payload too large", "payload_too_large", { cause }),
      status: 413,
      code: "payload_too_large",
    },
    {
      name: "unprocessable",
      error: new UnprocessableError("unprocessable", "unprocessable", { cause }),
      status: 422,
      code: "unprocessable",
    },
    {
      name: "unavailable",
      error: new UnavailableError("unavailable", "unavailable", { cause }),
      status: 503,
      code: "unavailable",
    },
    {
      name: "unexpected",
      error: new UnexpectedError("unexpected", { cause }),
      status: 500,
      code: "unexpected",
    },
  ]

  for (const entry of cases) {
    test(`maps ${entry.name} to ${entry.status} with a safe JSON body`, async () => {
      const exception = toHttpException(entry.error)
      const response = exception.getResponse()
      const body = (await response.json()) as Record<string, unknown>

      expect(exception.status).toBe(entry.status)
      expect(response.status).toBe(entry.status)
      expect(response.headers.get("content-type")).toBe("application/json")
      expect(body).toEqual({ error: entry.error.message, code: entry.code })
      expect(Object.keys(body).sort()).toEqual(["code", "error"])
      expect(JSON.stringify(body)).not.toContain(cause.message)
      expect(JSON.stringify(body)).not.toContain("cause")
    })
  }
})
