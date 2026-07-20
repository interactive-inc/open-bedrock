import { createAuditEvent } from "@/domain/audit/audit-event"
import type { Context, SessionPayload } from "@/env"
import { AuditEventRepository } from "@/infrastructure/audit/audit-event-repository"
import { factory } from "@/lib/factory"
import { hasPermission } from "@/lib/auth/has-permission"
import { canReadEmployees } from "@/lib/employee/can-read-employees"
import { resolveOrganizationAuthority } from "@/lib/org/organization-authority"

export type LifecycleReadAuthorization = {
  scope: "self" | "organization" | "all"
  auditAction: "employee.lifecycle.read" | "employee.lifecycle.read_all"
}

export async function resolveLifecycleReadAuthorization(
  c: Context,
  session: SessionPayload,
  targetEmployeeId: number,
): Promise<LifecycleReadAuthorization | null | Error> {
  if (session.employeeId === targetEmployeeId) {
    return { scope: "self", auditAction: "employee.lifecycle.read" }
  }
  if (hasPermission(session, "employee:lifecycle:read:all")) {
    return { scope: "all", auditAction: "employee.lifecycle.read_all" }
  }
  if (!canReadEmployees(session)) return null
  const authority = await resolveOrganizationAuthority(c, session.employeeId, targetEmployeeId)
  if (authority instanceof Error) return authority
  return authority.managementChain || authority.departmentManager
    ? { scope: "organization", auditAction: "employee.lifecycle.read" }
    : null
}

export async function resolveLifecycleApplyScope(
  c: Context,
  session: SessionPayload,
  targetEmployeeId: number,
): Promise<"all" | "organization" | null | Error> {
  if (!hasPermission(session, "employee:lifecycle:apply")) return null
  if (hasPermission(session, "employee:lifecycle:read:all")) return "all"
  const authority = await resolveOrganizationAuthority(c, session.employeeId, targetEmployeeId)
  if (authority instanceof Error) return authority
  return authority.managementChain || authority.departmentManager ? "organization" : null
}

export async function appendLifecycleReadAudit(props: {
  c: Context
  session: SessionPayload
  action: "employee.lifecycle.read" | "employee.lifecycle.read_all"
  targetEmployeeId: number
  scope: LifecycleReadAuthorization["scope"]
  resultCount: number
  filterFingerprint: string
}): Promise<void> {
  await new AuditEventRepository(props.c).append(
    createAuditEvent(
      {
        actorAccountId: props.session.accountId,
        actorEmployeeId: props.session.employeeId,
        action: props.action,
        target: { type: "employee", id: String(props.targetEmployeeId) },
        outcome: "succeeded",
        reasonCode: null,
        authorization: { scope: props.scope },
        metadata: {
          resultCount: props.resultCount,
          filterFingerprint: props.filterFingerprint,
        },
        now: new Date(props.c.env.NOW ?? new Date().toISOString()),
      },
      props.c.var.auditContext,
    ),
  )
}

export async function appendLifecycleDeniedAudit(props: {
  c: Context
  session: SessionPayload
  targetEmployeeId: number | null
  permission: "employee:lifecycle:apply" | "employee:lifecycle:read:all" | "employee:read"
  reasonCode: string
}): Promise<void> {
  await new AuditEventRepository(props.c).append(
    createAuditEvent(
      {
        actorAccountId: props.session.accountId,
        actorEmployeeId: props.session.employeeId,
        action: "employee.lifecycle.denied",
        target: {
          type: "employee",
          id: props.targetEmployeeId === null ? null : String(props.targetEmployeeId),
        },
        outcome: "denied",
        reasonCode: props.reasonCode,
        authorization: { permission: props.permission },
        now: new Date(props.c.env.NOW ?? new Date().toISOString()),
      },
      props.c.var.auditContext,
    ),
  )
}

export const lifecycleNoStore = factory.createMiddleware(async (c, next) => {
  await next()
  if (
    c.req.path.includes("/lifecycle-events") ||
    c.req.path.includes("/lifecycle-state") ||
    c.req.path.startsWith("/personnel-actions")
  ) {
    c.header("Cache-Control", "no-store")
  }
})
