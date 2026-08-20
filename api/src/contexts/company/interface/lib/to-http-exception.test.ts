import { describe, expect, test } from "bun:test"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
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
    test(`maps ${entry.name} to ${entry.status} without assembling JSON`, () => {
      const exception = toHttpException(entry.error)

      expect(exception.status).toBe(entry.status)
      expect(exception.message).toBe(entry.error.message)
      expect(exception.cause).toBe(entry.error)
      expect(entry.error.code).toBe(entry.code)
      expect(exception.res).toBeUndefined()
    })
  }
})
