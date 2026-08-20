import { toNegotiatedHttpExceptionResponse } from "@/api/to-negotiated-http-exception-response"
import {
  CompanyHttpError,
  type CompanyHttpErrorStatus,
} from "@/contexts/company/interface/http/errors/company-http-error"
import { OidcHttpError } from "@system/interface/http/errors/oidc-http-error"
import { SystemHttpError } from "@system/interface/http/errors/system-http-error"
import { ApplicationError } from "@/lib/errors"
import type { HonoEnv } from "@/env"
import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"

const companyProblemTitleByStatus: Readonly<Record<CompanyHttpErrorStatus, string>> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  413: "Content Too Large",
  415: "Unsupported Media Type",
  422: "Unprocessable Content",
  423: "Locked",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
}

/**
 * API 全体の例外を外部向け JSON に変換し、内部情報を応答へ漏らさない。
 */
export async function handleApiError(error: Error, context: Context<HonoEnv>): Promise<Response> {
  if (error instanceof OidcHttpError) {
    if (error.status >= 500) console.error("[expected server error]", error.cause ?? error)
    if (error.authenticate !== null) {
      context.header("WWW-Authenticate", error.authenticate)
    }

    return context.json({ error: error.code }, error.status, {
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    })
  }

  if (error instanceof SystemHttpError) {
    if (error.status >= 500) console.error("[expected server error]", error.cause ?? error)

    return context.json({ error: error.detail, code: error.code, ...error.metadata }, error.status)
  }

  if (error instanceof CompanyHttpError) {
    if (error.status >= 500) console.error("[expected server error]", error.cause ?? error)
    if (error.etag !== null) context.header("etag", error.etag)

    return context.json(
      {
        ...error.metadata,
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
