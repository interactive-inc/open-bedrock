/** /company/v1/profile */
import { readCompanyResources } from "@/contexts/company/application/core/read-company-resources"
import { writeCompanyResources } from "@/contexts/company/application/core/write-company-resources"
import type { CompanyJsonObject } from "@/contexts/company/domain/core/company-resource"
import { restoreCalendarDate } from "@/contexts/company/domain/workforce/restore-calendar-date"
import { readCompanyResourcesFromD1 } from "@/contexts/company/infrastructure/core/read-company-resources-from-d1"
import { writeCompanyResourcesToD1 } from "@/contexts/company/infrastructure/core/write-company-resources-to-d1"
import { CompanyHttpError } from "@/contexts/company/interface/http/errors/company-http-error"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/http/company-http-environment"
import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { z } from "zod"

const factory = createFactory<CompanyHttpEnvironment>()

// @authorization service
export const GET = factory.createHandlers(
  zValidator(
    "header",
    z.object({
      "x-company-organization-id": z.string().regex(/^\S{1,255}$/),
    }),
    (validation) => {
      if (!validation.success) {
        throw new CompanyHttpError({
          status: 400,
          code: "invalid_company_headers",
          detail: "Company request headers are invalid",
          cause: validation.error,
        })
      }
    },
  ),
  zValidator(
    "query",
    z.object({
      id: z
        .union([z.string().regex(/^\S{1,255}$/), z.array(z.string().regex(/^\S{1,255}$/)).max(100)])
        .optional(),
      effective_on: z.string().date().optional(),
      as_of: z.string().date().optional(),
    }),
    (validation) => {
      if (!validation.success) {
        throw new CompanyHttpError({
          status: 400,
          code: "invalid_company_query",
          detail: "Company query is invalid",
          cause: validation.error,
        })
      }
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) {
      throw new CompanyHttpError({
        status: 401,
        code: "authentication_required",
        detail: "Authentication is required",
      })
    }

    const database = context.env.DB
    if (database === undefined) {
      throw new CompanyHttpError({
        status: 503,
        code: "company_database_unavailable",
        detail: "Company storage is unavailable",
      })
    }

    const headers = context.req.valid("header")
    const requestQuery = context.req.valid("query")
    if (
      requestQuery.effective_on !== undefined &&
      requestQuery.as_of !== undefined &&
      requestQuery.effective_on !== requestQuery.as_of
    ) {
      throw new CompanyHttpError({
        status: 400,
        code: "invalid_company_query",
        detail: "effective_on and as_of must name the same date",
      })
    }

    const ids =
      requestQuery.id === undefined
        ? []
        : Array.isArray(requestQuery.id)
          ? requestQuery.id
          : [requestQuery.id]
    const effectiveOn = requestQuery.effective_on ?? requestQuery.as_of
    const query = {
      organizationId: headers["x-company-organization-id"],
      types: ["legal-entity", "company-profile"] as const,
      ...(ids.length === 0 ? {} : { ids }),
      ...(effectiveOn === undefined ? {} : { effectiveOn: restoreCalendarDate(effectiveOn) }),
    }
    const result = await readCompanyResources(actor, query, (resourceQuery) =>
      readCompanyResourcesFromD1(database, resourceQuery),
    )

    if (result.kind === "invalid") {
      throw new CompanyHttpError({
        status: 400,
        code: "invalid_company_query",
        detail: "Company query is invalid",
        cause: result.error,
      })
    }
    if (result.kind === "forbidden") {
      throw new CompanyHttpError({
        status: 403,
        code: "company_access_denied",
        detail: "Company scope or capability is missing",
      })
    }
    if (result.kind === "unavailable") {
      throw new CompanyHttpError({
        status: 503,
        code: "company_read_unavailable",
        detail: "Company data could not be read",
        cause: result.cause,
      })
    }

    context.header("etag", `"${result.organizationRevision}"`)

    return context.json(
      {
        organizationId: query.organizationId,
        organizationRevision: result.organizationRevision,
        resources: result.resources,
      },
      200,
    )
  },
)

// @authorization service
export const POST = factory.createHandlers(
  zValidator(
    "header",
    z.object({
      "x-company-organization-id": z.string().regex(/^\S{1,255}$/),
      "idempotency-key": z.string().regex(/^\S{1,255}$/),
      "if-match": z.string().regex(/^(?:W\/)?(?:"\d+"|\d+)$/),
    }),
    (validation) => {
      if (!validation.success) {
        throw new CompanyHttpError({
          status: 400,
          code: "invalid_company_headers",
          detail: "Company request headers are invalid",
          cause: validation.error,
        })
      }
    },
  ),
  zValidator(
    "json",
    z.object({
      reason: z.string().trim().min(1).max(2_000),
      resources: z
        .array(
          z.discriminatedUnion("type", [
            z.object({
              organizationId: z.string().regex(/^\S{1,255}$/),
              type: z.literal("legal-entity"),
              id: z.string().regex(/^\S{1,255}$/),
              revision: z.number().int().min(1),
              state: z.enum(["active", "void"]),
              effectiveFrom: z.string().date(),
              effectiveTo: z.string().date().nullable(),
              attributes: z
                .object({
                  officialName: z.string().trim().min(1).max(2_000),
                })
                .catchall(z.json()),
            }),
            z.object({
              organizationId: z.string().regex(/^\S{1,255}$/),
              type: z.literal("company-profile"),
              id: z.string().regex(/^\S{1,255}$/),
              revision: z.number().int().min(1),
              state: z.enum(["active", "void"]),
              effectiveFrom: z.string().date(),
              effectiveTo: z.string().date().nullable(),
              attributes: z
                .object({
                  displayName: z.string().trim().min(1).max(2_000),
                })
                .catchall(z.json()),
            }),
          ]),
        )
        .min(1)
        .max(100),
    }),
    (validation) => {
      if (!validation.success) {
        throw new CompanyHttpError({
          status: 400,
          code: "invalid_company_body",
          detail: "Company request body is invalid",
          cause: validation.error,
        })
      }
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) {
      throw new CompanyHttpError({
        status: 401,
        code: "authentication_required",
        detail: "Authentication is required",
      })
    }

    const database = context.env.DB
    if (database === undefined) {
      throw new CompanyHttpError({
        status: 503,
        code: "company_database_unavailable",
        detail: "Company storage is unavailable",
      })
    }

    const headers = context.req.valid("header")
    const body = context.req.valid("json")
    const organizationId = headers["x-company-organization-id"]
    if (body.resources.some((resource) => resource.organizationId !== organizationId)) {
      throw new CompanyHttpError({
        status: 422,
        code: "invalid_company_resource",
        detail: "A Company resource is outside the requested organization",
      })
    }

    const change = {
      commandId: headers["idempotency-key"],
      expectedRevision: Number(headers["if-match"].replace(/^W\//, "").replace(/^"|"$/g, "")),
      reason: body.reason,
      recordedAt: Date.now(),
      resources: body.resources.map((resource) => ({
        ...resource,
        effectiveFrom: restoreCalendarDate(resource.effectiveFrom),
        effectiveTo:
          resource.effectiveTo === null ? null : restoreCalendarDate(resource.effectiveTo),
        attributes: resource.attributes as CompanyJsonObject,
      })),
    }
    const result = await writeCompanyResources(actor, change, (resourceChange) =>
      writeCompanyResourcesToD1(database, resourceChange),
    )

    if (result.kind === "forbidden") {
      throw new CompanyHttpError({
        status: 403,
        code: "company_access_denied",
        detail: "Company scope or capability is missing",
      })
    }
    if (result.kind === "invalid") {
      throw new CompanyHttpError({
        status: 422,
        code: result.error.code,
        detail: "Company invariant validation failed",
        cause: result.error,
      })
    }
    if (result.kind === "conflict") {
      throw new CompanyHttpError({
        status: 409,
        code: "company_revision_conflict",
        detail: "Company revision has changed",
        etag: `"${result.actualRevision}"`,
      })
    }
    if (result.kind === "resource_conflict") {
      throw new CompanyHttpError({
        status: 409,
        code: "company_resource_conflict",
        detail: "Resource revision has changed",
      })
    }
    if (result.kind === "command_conflict") {
      throw new CompanyHttpError({
        status: 409,
        code: "company_command_conflict",
        detail: "Idempotency key was reused",
      })
    }
    if (result.kind === "unavailable") {
      throw new CompanyHttpError({
        status: 503,
        code: "company_write_unavailable",
        detail: "Company change was not applied",
        cause: result.cause,
      })
    }

    context.header("etag", `"${result.organizationRevision}"`)

    return context.json(
      {
        organizationId,
        organizationRevision: result.organizationRevision,
        replayed: result.replayed,
      },
      result.replayed ? 200 : 201,
    )
  },
)
