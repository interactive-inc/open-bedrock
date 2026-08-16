import type { RecruitmentCandidateRow } from "@/contexts/recruitment/infrastructure/schema/recruitment"
import { z } from "zod"

const zStage = z.enum(["applied", "screening", "interview", "offer", "hired", "rejected"])

const zProps = z.object({
  id: z.number().nullable(),
  positionId: z.number(),
  name: z.string(),
  email: z.string().nullable(),
  source: z.string().nullable(),
  stage: zStage,
  note: z.string().nullable(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

export type CandidateStage = z.infer<typeof zStage>

/**
 * 選考ステージの前進先。applied→screening→interview→offer→hired が正順。
 * rejected は hired 以外のどのステージからも遷移できる。hired/rejected は終端。
 */
const FORWARD_STAGE: Record<CandidateStage, CandidateStage | null> = {
  applied: "screening",
  screening: "interview",
  interview: "offer",
  offer: "hired",
  hired: null,
  rejected: null,
}

/** 応募者（社外個人情報）。id は新規作成時 null、DB 採番後に確定する。 */
export class RecruitmentCandidate implements Props {
  readonly id!: Props["id"]

  readonly positionId!: Props["positionId"]

  readonly name!: Props["name"]

  readonly email!: Props["email"]

  readonly source!: Props["source"]

  readonly stage!: Props["stage"]

  readonly note!: Props["note"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規登録する応募者を組み立てる。id は未採番、初期ステージは applied。 */
  static create(props: {
    positionId: number
    name: string
    email: string | null
    source: string | null
    note: string | null
    createdAt: string
  }): RecruitmentCandidate {
    return new RecruitmentCandidate({
      id: null,
      positionId: props.positionId,
      name: props.name,
      email: props.email,
      source: props.source,
      stage: "applied",
      note: props.note,
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: RecruitmentCandidateRow): RecruitmentCandidate {
    return new RecruitmentCandidate({
      id: row.id,
      positionId: row.positionId,
      name: row.name,
      email: row.email,
      source: row.source,
      stage: zStage.parse(row.stage),
      note: row.note,
      createdAt: row.createdAt,
    })
  }

  /** 名前・連絡先・流入元・備考を差し替える。ステージは保つ。 */
  withDetails(details: {
    name: Props["name"]
    email: Props["email"]
    source: Props["source"]
    note: Props["note"]
  }): RecruitmentCandidate {
    return new RecruitmentCandidate({
      ...this.props,
      name: details.name,
      email: details.email,
      source: details.source,
      note: details.note,
    })
  }

  /** 指定ステージへ遷移してよいか判定する。正順の1つ先、または（hired 以外からの）rejected のみ許す。 */
  canAdvanceTo(next: CandidateStage): boolean {
    if (next === "rejected") {
      return this.stage !== "hired" && this.stage !== "rejected"
    }

    return FORWARD_STAGE[this.stage] === next
  }

  /** ステージを差し替えた応募者を返す（遷移可否は呼び出し側が canAdvanceTo で確認する）。 */
  withStage(next: CandidateStage): RecruitmentCandidate {
    return new RecruitmentCandidate({
      ...this.props,
      stage: next,
    })
  }
}
