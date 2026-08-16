import { resolveActiveSystemAccountId } from "@/contexts/company/application/iam/to-system-account-id"
import {
  createCompanyProcedureDecisionPolicy,
  parseCompanyProcedureDecisionPolicy,
  type CompanyProcedureDecisionPolicy,
} from "@/contexts/company/domain/organization/company-procedure-decision-policy"
import type { Context } from "@/env"
import { PublishSystemProcedure } from "@system/application/workflow/publish-system-procedure"
import type { ProcedureDefinition } from "@system/domain/workflow/procedure-definition.entity"
import { procedureKeySchema } from "@system/domain/workflow/procedure-definition.entity"
import { SystemD1ProcedureRepository } from "@system/infrastructure/workflow/system-d1-procedure-repository"

export function systemProcedureRepository(c: Context): SystemD1ProcedureRepository {
  return new SystemD1ProcedureRepository({ env: { DB: c.env.DB } })
}

export async function loadSystemProcedure(
  c: Context,
  code: string,
): Promise<ProcedureDefinition | null | Error> {
  const key = procedureKeySchema.safeParse(code)
  if (!key.success) return null

  return systemProcedureRepository(c).findCurrent(key.data)
}

export function parseSystemProcedurePolicy(
  definition: ProcedureDefinition,
): CompanyProcedureDecisionPolicy | Error {
  try {
    return parseCompanyProcedureDecisionPolicy(JSON.parse(definition.decisionPolicyJson))
  } catch (cause) {
    return new Error("invalid System procedure decision policy", { cause })
  }
}

export function parseSystemProcedureInputSchema(
  definition: ProcedureDefinition,
): Readonly<{ value: unknown }> | Error {
  try {
    return { value: JSON.parse(definition.inputSchemaJson) }
  } catch (cause) {
    return new Error("invalid System procedure input schema", { cause })
  }
}

export async function publishSystemProcedure(
  c: Context,
  input: Readonly<{
    code: string
    expectedRevision: number
    name: string
    category: string
    description: string | null
    schemaJson: unknown
    policy: CompanyProcedureDecisionPolicy
    completionOperationKey: string | null
  }>,
): Promise<ProcedureDefinition | "revision_conflict" | Error> {
  const session = c.var.session
  if (session === null) return new Error("authenticated session is missing")
  const accountId = await resolveActiveSystemAccountId(c, session.accountId)
  if (accountId instanceof Error) return accountId

  return new PublishSystemProcedure(systemProcedureRepository(c)).run({
    key: input.code,
    expectedRevision: input.expectedRevision,
    title: input.name,
    category: input.category,
    description: input.description,
    inputSchema: input.schemaJson,
    decisionPolicy: input.policy,
    completionOperationKey: input.completionOperationKey,
    createdByAccountId: accountId,
    createdAt: new Date(c.env.NOW ?? Date.now()),
  })
}

export function createLegacyCompanyPolicy(
  approverRoles: ReadonlyArray<string>,
): CompanyProcedureDecisionPolicy | Error {
  return createCompanyProcedureDecisionPolicy({ approverRoles, workflow: null })
}
