import { toHttpException } from "@/interface/lib/to-http-exception"
import { ApplicationError } from "@/lib/errors"
import { auditUnavailable } from "@/interface/utils/audit-unavailable"

/** Converts all route-boundary application errors while hiding non-application causes. */
export function throwAuditRouteError(error: unknown): never {
  if (error instanceof ApplicationError) throw toHttpException(error)
  throw toHttpException(auditUnavailable(error))
}
