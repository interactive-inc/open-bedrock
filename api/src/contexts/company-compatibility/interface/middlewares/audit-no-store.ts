import { factory } from "@/contexts/company-compatibility/interface/utils/factory"

function isAuditResponsePath(path: string): boolean {
  return (
    path === "/audit-events" || path.startsWith("/audit-events/") || path === "/audit-event-exports"
  )
}

/** Overwrites cache policy after all inner middleware, including handled error responses. */
export const auditNoStore = factory.createMiddleware(async (c, next) => {
  await next()
  if (isAuditResponsePath(c.req.path)) c.header("Cache-Control", "no-store")
})
