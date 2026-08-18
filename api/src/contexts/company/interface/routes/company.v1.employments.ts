/** /company/v1/employments */
import { readCompanyResources } from "@/contexts/company/application/core/read-company-resources"
import { writeCompanyResources } from "@/contexts/company/application/core/write-company-resources"
import type { CompanyJsonObject } from "@/contexts/company/domain/core/company-resource"
import { restoreCalendarDate } from "@/contexts/company/domain/workforce/restore-calendar-date"
import { readCompanyResourcesFromD1 } from "@/contexts/company/infrastructure/core/read-company-resources-from-d1"
import { writeCompanyResourcesToD1 } from "@/contexts/company/infrastructure/core/write-company-resources-to-d1"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/http/company-http-environment"
import { createCompanyProblem } from "@/contexts/company/interface/http/create-company-problem"
import { readCompanyRequestRuntime } from "@/contexts/company/interface/http/read-company-request-runtime"
import { respondToCompanyRead } from "@/contexts/company/interface/http/respond-to-company-read"
import { respondToCompanyWrite } from "@/contexts/company/interface/http/respond-to-company-write"
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
  ),
  async (context) => {
    const runtime = readCompanyRequestRuntime(context)
    if ("status" in runtime) {
      return createCompanyProblem(context, runtime.status, runtime.code, runtime.detail)
    }

    const headers = context.req.valid("header")
    const requestQuery = context.req.valid("query")
    if (
      requestQuery.effective_on !== undefined &&
      requestQuery.as_of !== undefined &&
      requestQuery.effective_on !== requestQuery.as_of
    ) {
      return createCompanyProblem(
        context,
        400,
        "invalid_company_query",
        "effective_on and as_of must name the same date",
      )
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
      types: ["employment"] as const,
      ...(ids.length === 0 ? {} : { ids }),
      ...(effectiveOn === undefined ? {} : { effectiveOn: restoreCalendarDate(effectiveOn) }),
    }
    const result = await readCompanyResources(runtime.actor, query, (resourceQuery) =>
      readCompanyResourcesFromD1(runtime.database, resourceQuery),
    )

    return respondToCompanyRead(context, query.organizationId, result)
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
  ),
  zValidator(
    "json",
    z.object({
      reason: z.string().trim().min(1).max(2_000),
      resources: z
        .array(
          z.object({
            organizationId: z.string().regex(/^\S{1,255}$/),
            type: z.literal("employment"),
            id: z.string().regex(/^\S{1,255}$/),
            revision: z.number().int().min(1),
            state: z.enum(["active", "void"]),
            effectiveFrom: z.string().date(),
            effectiveTo: z.string().date().nullable(),
            attributes: z
              .object({
                employeeId: z.string().regex(/^\S{1,255}$/),
                status: z.enum(["ACTIVE", "ON_LEAVE", "RETIRED"]),
                employmentType: z.string().trim().min(1).max(255).optional(),
                officialName: z.string().trim().min(1).max(2_000).optional(),
              })
              .catchall(z.json()),
          }),
        )
        .min(1)
        .max(100),
    }),
  ),
  async (context) => {
    const runtime = readCompanyRequestRuntime(context)
    if ("status" in runtime) {
      return createCompanyProblem(context, runtime.status, runtime.code, runtime.detail)
    }

    const headers = context.req.valid("header")
    const body = context.req.valid("json")
    const organizationId = headers["x-company-organization-id"]
    if (body.resources.some((resource) => resource.organizationId !== organizationId)) {
      return createCompanyProblem(
        context,
        422,
        "invalid_company_resource",
        "A Company resource is outside the requested organization",
      )
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
    const result = await writeCompanyResources(runtime.actor, change, (resourceChange) =>
      writeCompanyResourcesToD1(runtime.database, resourceChange),
    )

    return respondToCompanyWrite(context, organizationId, result)
  },
)
