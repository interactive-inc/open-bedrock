import { z } from "zod"
import type { OnboardingContext } from "@/contexts/onboarding/configuration/onboarding-context"
import {
  decodeOnboardingTemplateTaskRecordId,
  encodeOnboardingTemplateTaskRecordId,
  onboardingRecordKindSchema,
} from "@/contexts/onboarding/domain/definitions/onboarding-record-kind.definition"
import { OnboardingActorReadAdapter } from "@/contexts/onboarding/infrastructure/adapters/onboarding-actor-read.adapter"
import { openSystemRecordSourceFreezes } from "@system/interface/operations/open-system-record-source-freezes"

type Context = OnboardingContext

const inputSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().min(1).max(255).regex(/^\S+$/),
  recordKind: onboardingRecordKindSchema,
  afterCursor: z.string().nullable(),
  limit: z.number().int().min(1).max(100),
})

const uuidTables = {
  "onboarding-template-record": "onboarding_templates",
  "onboarding-assignment-record": "onboarding_assignments",
  "onboarding-task-record": "onboarding_tasks",
} as const

const textTables = {
  "onboarding-lifecycle-delivery-record":
    "SELECT job_id AS record_id FROM onboarding_lifecycle_deliveries",
  "onboarding-lifecycle-template-binding-record":
    "SELECT effect_type AS record_id FROM onboarding_lifecycle_template_bindings",
} as const

const textKeys = {
  "onboarding-lifecycle-delivery-record": "job_id",
  "onboarding-lifecycle-template-binding-record": "effect_type",
} as const

/** 停止した6台帳を各主キーの順序で分割し、停止世代も同じ読取で確認する。 */
export class ListFrozenOnboardingRecordPageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown) {
    const parsed = inputSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const actor = await new OnboardingActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    const generation = await openSystemRecordSourceFreezes({
      env: this.c.env,
      assertions: actor.assertions,
    }).prepareActiveGeneration({
      id: request.freezeId,
      sourceNamespace: request.sourceNamespace,
      ownerContext: "onboarding",
    })
    if (generation instanceof Error) return generation
    const after = request.afterCursor
    const uuidTable = uuidTables[request.recordKind as keyof typeof uuidTables]
    const textTable = textTables[request.recordKind as keyof typeof textTables]
    const textKey = textKeys[request.recordKind as keyof typeof textKeys]
    const taskCursor =
      request.recordKind === "onboarding-template-task-record" && after !== null
        ? decodeOnboardingTemplateTaskRecordId(after)
        : null
    if (
      after !== null &&
      (uuidTable
        ? !z.uuid().safeParse(after).success
        : request.recordKind === "onboarding-template-task-record"
          ? taskCursor === null
          : after.length === 0)
    )
      return new Error("invalid onboarding cursor")
    try {
      const db = this.c.env.DB
      const page = uuidTable
        ? after === null
          ? db
              .prepare(
                `SELECT id AS record_id FROM ${uuidTable} ORDER BY id COLLATE BINARY LIMIT ?1`,
              )
              .bind(request.limit + 1)
          : db
              .prepare(
                `SELECT id AS record_id FROM ${uuidTable} WHERE id COLLATE BINARY>?1 ORDER BY id COLLATE BINARY LIMIT ?2`,
              )
              .bind(after, request.limit + 1)
        : request.recordKind === "onboarding-template-task-record"
          ? taskCursor === null
            ? db
                .prepare(
                  `SELECT template_code, code FROM onboarding_template_tasks ORDER BY template_code,code LIMIT ?1`,
                )
                .bind(request.limit + 1)
            : db
                .prepare(
                  `SELECT template_code, code FROM onboarding_template_tasks WHERE template_code>?1 OR (template_code=?1 AND code>?2) ORDER BY template_code,code LIMIT ?3`,
                )
                .bind(taskCursor.templateCode, taskCursor.code, request.limit + 1)
          : after === null
            ? db.prepare(`${textTable} ORDER BY ${textKey} LIMIT ?1`).bind(request.limit + 1)
            : db
                .prepare(`${textTable} WHERE ${textKey}>?1 ORDER BY ${textKey} LIMIT ?2`)
                .bind(after, request.limit + 1)
      const statements = [...generation.assertions, page, ...generation.assertions]
      const reads = await db.batch<{
        record_id?: string
        template_code?: string
        code?: string
      }>(statements)
      if (reads.length !== statements.length || reads.some((read) => !read.success))
        return new Error("frozen onboarding inventory unavailable")
      const ids = (reads[generation.assertions.length]?.results ?? []).map((row) =>
        request.recordKind === "onboarding-template-task-record"
          ? encodeOnboardingTemplateTaskRecordId(String(row.template_code), String(row.code))
          : String(row.record_id),
      )
      if (new Set(ids).size !== ids.length || ids.some((id) => id.length === 0))
        return new Error("invalid onboarding inventory")
      const recordIds = ids.slice(0, request.limit)
      return Object.freeze({
        freezeId: generation.freeze.snapshot.id,
        recordIds: Object.freeze(recordIds),
        nextCursor: ids.length > request.limit ? (recordIds.at(-1) ?? null) : null,
        assertions: generation.assertions,
      })
    } catch (cause) {
      return new Error("frozen onboarding inventory unavailable", { cause })
    }
  }
}
