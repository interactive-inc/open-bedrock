import { toNegotiatedHttpExceptionResponse } from "@/api/to-negotiated-http-exception-response"
import { CompanyHttpError } from "@/contexts/company/interface/http/company-http-error"
import { ApplicationError } from "@/lib/errors"
import type { HonoEnv } from "@/env"
import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"

const companyProblemTitleByStatus: Readonly<Record<CompanyHttpError["status"], string>> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  413: "Content Too Large",
  422: "Unprocessable Content",
  429: "Too Many Requests",
  500: "Internal Server Error",
  503: "Service Unavailable",
}

/**
 * API 全体の例外を外部向け JSON に変換し、内部情報を応答へ漏らさない。
 */
export async function handleApiError(error: Error, context: Context<HonoEnv>): Promise<Response> {
  if (error instanceof CompanyHttpError) {
    if (error.status >= 500) console.error("[expected server error]", error.cause ?? error)
    if (error.etag !== null) context.header("etag", error.etag)

    return context.json(
      {
        type: `/problems/${error.code}`,
        title: companyProblemTitleByStatus[error.status],
        status: error.status,
        code: error.code,
        detail: error.detail,
        ...(error.issues === null ? {} : { issues: error.issues }),
      },
      error.status,
      { "content-type": "application/problem+json" },
    )
  }

  if (error instanceof HTTPException) {
    if (error.cause instanceof ApplicationError) {
      if (error.status >= 500) {
        console.error("[expected server error]", error.cause.cause ?? error.cause)
      }

      return context.json({ error: error.message, code: error.cause.code }, error.status)
    }

    if (error.res) {
      const negotiated = await toNegotiatedHttpExceptionResponse({
        error,
        accept: context.req.header("accept") ?? null,
      })
      if (negotiated !== null) return negotiated

      return error.getResponse()
    }

    return context.json({ error: error.message }, error.status)
  }

  console.error("[unhandled error]", error)

  return context.json({ error: "internal server error" }, 500)
}
