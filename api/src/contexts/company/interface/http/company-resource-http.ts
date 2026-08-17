import {
  CompanyResourceService,
  type CompanyActor,
} from "@/contexts/company/application/core/company-resource.service"
import type { CompanyResourceType } from "@/contexts/company/domain/core/company-resource"
import {
  isCompanyIdentifier,
  isCompanyResourceType,
  validateCompanyResource,
  type CompanyJsonObject,
  type CompanyResource,
} from "@/contexts/company/domain/core/company-resource"
import type { CalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/core/d1-company-resource.repository"
import { createFactory } from "hono/factory"

const factory = createFactory()

type CompanyRequestVariables = Readonly<{ companyActor?: CompanyActor }>
type CompanyRequestBindings = Readonly<{ DB?: D1Database }>

function problem(
  context: Parameters<Parameters<typeof factory.createHandlers>[0]>[0],
  status: 400 | 401 | 403 | 409 | 422 | 503,
  code: string,
  detail: string,
) {
  return context.json(
    {
      type: `https://company.invalid/problems/${code}`,
      title: code.replaceAll("_", " "),
      status,
      code,
      detail,
    },
    status,
    { "content-type": "application/problem+json" },
  )
}

function requestServices(context: Parameters<Parameters<typeof factory.createHandlers>[0]>[0]) {
  const actor = (context.var as CompanyRequestVariables).companyActor
  if (actor === undefined) return new Error("authentication_required")
  const database = (context.env as CompanyRequestBindings).DB
  if (database === undefined) return new Error("company_database_unavailable")
  return { actor, service: new CompanyResourceService(new D1CompanyResourceRepository(database)) }
}

function organizationId(context: Parameters<Parameters<typeof factory.createHandlers>[0]>[0]) {
  const value = context.req.header("x-company-organization-id")
  return value !== undefined && isCompanyIdentifier(value) ? value : null
}

function parseExpectedRevision(value: string | undefined): number | null {
  if (value === undefined) return null
  const normalized = value.replace(/^W\//, "").replace(/^"|"$/g, "")
  if (!/^\d+$/.test(normalized)) return null
  const revision = Number(normalized)
  return Number.isSafeInteger(revision) ? revision : null
}

function parseResource(value: unknown, expectedOrganizationId: string): CompanyResource | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (
    record.organizationId !== expectedOrganizationId ||
    typeof record.type !== "string" ||
    !isCompanyResourceType(record.type) ||
    typeof record.id !== "string" ||
    typeof record.revision !== "number" ||
    (record.state !== "active" && record.state !== "void") ||
    typeof record.effectiveFrom !== "string" ||
    (record.effectiveTo !== null && typeof record.effectiveTo !== "string") ||
    record.attributes === null ||
    typeof record.attributes !== "object" ||
    Array.isArray(record.attributes)
  ) {
    return null
  }
  const resource: CompanyResource = {
    organizationId: expectedOrganizationId,
    type: record.type,
    id: record.id,
    revision: record.revision,
    state: record.state,
    effectiveFrom: record.effectiveFrom as CalendarDate,
    effectiveTo: record.effectiveTo as CalendarDate | null,
    attributes: record.attributes as CompanyJsonObject,
  }
  return validateCompanyResource(resource) === null ? resource : null
}

async function readJsonBody(
  context: Parameters<Parameters<typeof factory.createHandlers>[0]>[0],
): Promise<Readonly<{ ok: true; value: unknown }> | Readonly<{ ok: false }>> {
  return context.req.json().then(
    (value: unknown) => ({ ok: true, value }),
    () => ({ ok: false }),
  )
}

export function createCompanyReadHandlers(types: ReadonlyArray<CompanyResourceType>) {
  return factory.createHandlers(async (context) => {
    const runtime = requestServices(context)
    if (runtime instanceof Error) {
      return runtime.message === "authentication_required"
        ? problem(context, 401, runtime.message, "Authentication is required")
        : problem(context, 503, runtime.message, "Company storage is unavailable")
    }
    const scopedOrganizationId = organizationId(context)
    if (scopedOrganizationId === null) {
      return problem(
        context,
        400,
        "organization_id_required",
        "x-company-organization-id must contain an opaque organization ID",
      )
    }
    const ids = context.req.queries("id") ?? []
    const effectiveOn = context.req.query("effective_on") ?? context.req.query("as_of")
    if (
      (context.req.query("effective_on") !== undefined &&
        context.req.query("as_of") !== undefined &&
        context.req.query("effective_on") !== context.req.query("as_of")) ||
      ids.length > 100
    ) {
      return problem(context, 400, "invalid_company_query", "Company query is invalid")
    }
    const result = await runtime.service.read(runtime.actor, {
      organizationId: scopedOrganizationId,
      types,
      ...(ids.length > 0 ? { ids } : {}),
      ...(effectiveOn === undefined ? {} : { effectiveOn: effectiveOn as CalendarDate }),
    })
    if (result.kind === "invalid") {
      return problem(context, 400, "invalid_company_query", "Company query is invalid")
    }
    if (result.kind === "forbidden") {
      return problem(
        context,
        403,
        "company_access_denied",
        "Company scope or capability is missing",
      )
    }
    if (result.kind === "unavailable") {
      return problem(context, 503, "company_read_unavailable", "Company data could not be read")
    }
    context.header("etag", `"${result.organizationRevision}"`)
    return context.json(
      {
        organizationId: scopedOrganizationId,
        organizationRevision: result.organizationRevision,
        resources: result.resources,
      },
      200,
    )
  })
}

export function createCompanyWriteHandlers(types: ReadonlyArray<CompanyResourceType>) {
  return factory.createHandlers(async (context) => {
    const runtime = requestServices(context)
    if (runtime instanceof Error) {
      return runtime.message === "authentication_required"
        ? problem(context, 401, runtime.message, "Authentication is required")
        : problem(context, 503, runtime.message, "Company storage is unavailable")
    }
    const scopedOrganizationId = organizationId(context)
    const commandId = context.req.header("idempotency-key")
    const expectedRevision = parseExpectedRevision(context.req.header("if-match"))
    if (scopedOrganizationId === null || commandId === undefined || expectedRevision === null) {
      return problem(
        context,
        400,
        "company_write_precondition_required",
        "organization, idempotency-key, and if-match revision are required",
      )
    }

    const parsedBody = await readJsonBody(context)
    if (!parsedBody.ok) {
      return problem(context, 400, "invalid_json", "Request body must be valid JSON")
    }
    const body = parsedBody.value
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return problem(context, 422, "invalid_company_change", "Request body is invalid")
    }
    const record = body as Record<string, unknown>
    if (
      !Array.isArray(record.resources) ||
      record.resources.length < 1 ||
      record.resources.length > 100 ||
      typeof record.reason !== "string"
    ) {
      return problem(context, 422, "invalid_company_change", "resources and reason are required")
    }
    const resources = record.resources.map((resource) =>
      parseResource(resource, scopedOrganizationId),
    )
    if (resources.some((resource) => resource === null)) {
      return problem(context, 422, "invalid_company_resource", "A Company resource is invalid")
    }

    const result = await runtime.service.write(
      runtime.actor,
      {
        commandId,
        expectedRevision,
        reason: record.reason,
        recordedAt: Date.now(),
        resources: resources as CompanyResource[],
      },
      types,
    )
    if (result.kind === "forbidden") {
      return problem(
        context,
        403,
        "company_access_denied",
        "Company scope or capability is missing",
      )
    }
    if (result.kind === "invalid") {
      return problem(context, 422, result.error.code, "Company invariant validation failed")
    }
    if (result.kind === "conflict") {
      context.header("etag", `"${result.actualRevision}"`)
      return problem(context, 409, "company_revision_conflict", "Company revision has changed")
    }
    if (result.kind === "resource_conflict") {
      return problem(context, 409, "company_resource_conflict", "Resource revision has changed")
    }
    if (result.kind === "command_conflict") {
      return problem(context, 409, "company_command_conflict", "Idempotency key was reused")
    }
    if (result.kind === "unavailable") {
      return problem(context, 503, "company_write_unavailable", "Company change was not applied")
    }
    context.header("etag", `"${result.organizationRevision}"`)
    return context.json(
      {
        organizationId: scopedOrganizationId,
        organizationRevision: result.organizationRevision,
        replayed: result.replayed,
      },
      result.replayed ? 200 : 201,
    )
  })
}
