import { parseDocument } from "yaml"
import { z } from "zod"

const code = z
  .string()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9._-]*$/)

const referenceCode = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/)

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const zGovernanceReferenceKind = z.enum([
  "capability",
  "org_role",
  "policy",
  "procedure",
  "guideline",
  "control",
  "permission",
  "training",
])

export type GovernanceReferenceKind = z.infer<typeof zGovernanceReferenceKind>

export const zGovernanceReference = z.strictObject({
  kind: zGovernanceReferenceKind,
  code: referenceCode,
})

export type GovernanceReference = z.infer<typeof zGovernanceReference>

export const zProcedureAssignee = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.enum(["starter", "subject_employee", "direct_manager", "department_manager"]),
  }),
  z.strictObject({ type: z.literal("org_role"), code }),
])

export const zProcedureStep = z.strictObject({
  key: code,
  name: z.string().min(1).max(200),
  kind: z.enum([
    "instruction",
    "checklist",
    "acknowledgement",
    "training",
    "evidence",
    "notification",
    "automation",
    "decision",
    "approval",
  ]),
  description: z.string().max(2_000).nullable().default(null),
  assignee: zProcedureAssignee.nullable().default(null),
  due_days: z.number().int().min(0).max(3650).nullable().default(null),
  required: z.boolean().default(true),
  training_code: referenceCode.nullable().default(null),
  evidence_required: z.boolean().default(false),
})

export const zProcedureDefinition = z
  .strictObject({
    execution: z.enum(["sequence", "checklist"]).default("sequence"),
    steps: z.array(zProcedureStep).min(1).max(100),
  })
  .superRefine((procedure, ctx) => {
    const seen = new Set<string>()
    for (const [index, step] of procedure.steps.entries()) {
      if (seen.has(step.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["steps", index, "key"],
          message: "step key must be unique",
        })
      }
      seen.add(step.key)
      if (step.kind === "training" && step.training_code === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["steps", index, "training_code"],
          message: "training step requires training_code",
        })
      }
    }
  })

export type ProcedureDefinition = z.infer<typeof zProcedureDefinition>

const zAudience = z.strictObject({
  all_employees: z.boolean().default(true),
  employee_statuses: z.array(z.enum(["active", "leave"])).default(["active", "leave"]),
  department_codes: z.array(code).max(100).default([]),
  org_roles: z.array(code).max(100).default([]),
})

const zPublication = z
  .strictObject({
    mode: z.enum(["direct", "approval"]).default("direct"),
    approver_org_roles: z.array(code).max(20).default([]),
  })
  .superRefine((publication, ctx) => {
    if (publication.mode === "approval" && publication.approver_org_roles.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["approver_org_roles"],
        message: "approval publication requires approver_org_roles",
      })
    }
    if (publication.mode === "direct" && publication.approver_org_roles.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["approver_org_roles"],
        message: "direct publication cannot declare approver_org_roles",
      })
    }
  })

const zAuthorityRule = z.strictObject({
  key: code,
  capability: code,
  action: code,
  effect: z.enum(["allow", "deny", "require_approval"]),
  initiator_org_roles: z.array(code).max(20).default([]),
  decider_org_roles: z.array(code).max(20).default([]),
  consulted_org_roles: z.array(code).max(20).default([]),
  amount_min: z.number().nonnegative().nullable().default(null),
  amount_max: z.number().nonnegative().nullable().default(null),
  currency: z.string().length(3).nullable().default(null),
  emergency_post_review: z.boolean().default(false),
  retention_years: z.number().int().min(0).max(100).nullable().default(null),
})

const zControl = z.strictObject({
  key: code,
  owner_org_role: code,
  trigger: z.enum(["event", "schedule", "continuous"]),
  cadence: z.string().max(40).nullable().default(null),
  evidence: z.string().min(1).max(300),
  procedure: code.nullable().default(null),
})

export const zGovernanceMetadata = z
  .strictObject({
    id: code,
    title: z.string().min(1).max(500),
    kind: z.enum(["policy", "procedure", "guideline", "control"]),
    version: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
    classification: z.enum(["public", "internal", "confidential", "restricted"]),
    owner_capability: code,
    steward_org_role: code.nullable().default(null),
    effective_from: date.nullable().default(null),
    effective_to: date.nullable().default(null),
    review_due_on: date.nullable().default(null),
    audience: zAudience.default({}),
    publication: zPublication.default({}),
    acknowledgement: z
      .strictObject({
        required: z.boolean().default(false),
        renew_on_change: z.boolean().default(true),
      })
      .default({}),
    tags: z.array(code).max(50).default([]),
    references: z.array(zGovernanceReference).max(200).default([]),
    procedure: zProcedureDefinition.nullable().default(null),
    authority_rules: z.array(zAuthorityRule).max(200).default([]),
    controls: z.array(zControl).max(200).default([]),
  })
  .superRefine((metadata, ctx) => {
    if (
      (metadata.classification === "confidential" || metadata.classification === "restricted") &&
      metadata.audience.all_employees
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["audience", "all_employees"],
        message: "confidential and restricted documents need an explicit audience",
      })
    }
    if (metadata.kind === "procedure" && metadata.procedure === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["procedure"],
        message: "procedure document requires procedure definition",
      })
    }
    if (
      metadata.effective_from !== null &&
      metadata.effective_to !== null &&
      metadata.effective_from >= metadata.effective_to
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["effective_to"],
        message: "effective_to must be after effective_from",
      })
    }
    for (const [index, rule] of metadata.authority_rules.entries()) {
      if (
        rule.amount_min !== null &&
        rule.amount_max !== null &&
        rule.amount_min > rule.amount_max
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["authority_rules", index, "amount_max"],
          message: "amount_max must be greater than or equal to amount_min",
        })
      }
      if (rule.effect === "require_approval" && rule.decider_org_roles.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["authority_rules", index, "decider_org_roles"],
          message: "require_approval rule needs a decider",
        })
      }
    }
  })

export type GovernanceMetadata = z.infer<typeof zGovernanceMetadata>

export type ParsedGovernanceMarkdown = {
  metadata: GovernanceMetadata
  bodyMd: string
  references: ReadonlyArray<GovernanceReference>
}

const bodyReferencePattern =
  /\[\[(capability|org-role|policy|procedure|guideline|control|permission|training):([A-Za-z0-9][A-Za-z0-9._:-]*)\]\]/g

export function parseGovernanceMarkdown(raw: string): ParsedGovernanceMarkdown | Error {
  if (raw.length === 0 || raw.length > 300_000) {
    return new Error("governance Markdown must be between 1 and 300000 characters")
  }
  const normalized = raw.replace(/\r\n/g, "\n")
  if (!normalized.startsWith("---\n")) return new Error("YAML front matter is required")
  const frontMatterEnd = normalized.indexOf("\n---\n", 4)
  if (frontMatterEnd < 0) return new Error("YAML front matter is not closed")

  const yaml = normalized.slice(4, frontMatterEnd)
  const parsedYaml = parseDocument(yaml, { uniqueKeys: true })
  if (parsedYaml.errors.length > 0)
    return new Error(parsedYaml.errors[0]?.message ?? "invalid YAML")
  const metadata = zGovernanceMetadata.safeParse(parsedYaml.toJS({ maxAliasCount: 20 }))
  if (!metadata.success) return new Error(metadata.error.message)

  const bodyMd = normalized.slice(frontMatterEnd + 5).trim()
  if (bodyMd.length === 0) return new Error("Markdown body is required")

  return {
    metadata: metadata.data,
    bodyMd,
    references: collectReferences(metadata.data, bodyMd),
  }
}

function collectReferences(
  metadata: GovernanceMetadata,
  bodyMd: string,
): ReadonlyArray<GovernanceReference> {
  const refs: Array<GovernanceReference> = [
    { kind: "capability", code: metadata.owner_capability },
    ...metadata.references,
    ...metadata.audience.org_roles.map((value) => ({ kind: "org_role" as const, code: value })),
    ...metadata.publication.approver_org_roles.map((value) => ({
      kind: "org_role" as const,
      code: value,
    })),
    ...metadata.authority_rules.flatMap((rule) => [
      { kind: "capability" as const, code: rule.capability },
      ...[...rule.initiator_org_roles, ...rule.decider_org_roles, ...rule.consulted_org_roles].map(
        (value) => ({ kind: "org_role" as const, code: value }),
      ),
    ]),
    ...metadata.controls.flatMap((control) => [
      { kind: "org_role" as const, code: control.owner_org_role },
      ...(control.procedure === null
        ? []
        : [{ kind: "procedure" as const, code: control.procedure }]),
    ]),
  ]
  if (metadata.steward_org_role !== null) {
    refs.push({ kind: "org_role", code: metadata.steward_org_role })
  }
  if (metadata.procedure !== null) {
    for (const step of metadata.procedure.steps) {
      if (step.assignee?.type === "org_role") {
        refs.push({ kind: "org_role", code: step.assignee.code })
      }
      if (step.training_code !== null) refs.push({ kind: "training", code: step.training_code })
    }
  }
  for (const match of bodyMd.matchAll(bodyReferencePattern)) {
    const rawKind = match[1]
    const codeValue = match[2]
    if (rawKind === undefined || codeValue === undefined) continue
    refs.push({
      kind: rawKind === "org-role" ? "org_role" : zGovernanceReferenceKind.parse(rawKind),
      code: codeValue,
    })
  }

  const unique = new Map<string, GovernanceReference>()
  for (const ref of refs) unique.set(`${ref.kind}:${ref.code}`, ref)
  return [...unique.values()]
}
