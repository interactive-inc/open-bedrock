import type { SkillContext } from "@/contexts/skill/configuration/skill-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureSkillRecordAdapter } from "@/contexts/skill/infrastructure/adapters/capture-skill-record.adapter"
import { SkillError } from "@/contexts/skill/domain/errors"
import { skillRecordKindSchema } from "@/contexts/skill/domain/skill-record-kind"

type Context = SkillContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateSkillRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "skill"
    )
      return new SkillError("forbidden", "record source does not belong to this skill registry")

    const recordKind = skillRecordKindSchema.safeParse(source.props.recordKind)
    if (!recordKind.success)
      return new SkillError("forbidden", "invalid skill record kind")
    const current = await new CaptureSkillRecordAdapter(this.c).prepare({
      recordKind: recordKind.data,
      recordId: source.props.recordId,
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new SkillError(
        "skill_conflict",
        "skill record differs from preservation proposal",
      )

    return Object.freeze({
      source,
      content: current.content,
      actorAccountId: current.actorAccountId,
      sourceAuthorizationRef: current.sourceAuthorizationRef,
      assertions: Object.freeze(current.assertions),
    })
  }
}
