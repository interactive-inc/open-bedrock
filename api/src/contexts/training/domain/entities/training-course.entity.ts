import type { TrainingCourseRow } from "@/contexts/training/infrastructure/schema/training"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  code: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  durationMinutes: z.number().nullable(),
  category: z.string(),
  isRequired: z.boolean(),
  status: z.enum(["active", "archived"]),
})

type Props = z.infer<typeof zProps>

/** 研修コース（コード・タイトル・カテゴリ・必須フラグ・状態）。集約ルート。 */
export class TrainingCourse implements Props {
  /** 永続化前は null、DB 採番後に確定する。 */
  readonly id!: Props["id"]

  readonly code!: Props["code"]

  readonly title!: Props["title"]

  readonly description!: Props["description"]

  readonly durationMinutes!: Props["durationMinutes"]

  readonly category!: Props["category"]

  readonly isRequired!: Props["isRequired"]

  readonly status!: Props["status"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規作成する研修コースを組み立てる。id は未採番、初期状態は active。 */
  static create(props: {
    code: string
    title: string
    category: string
    description: string | null
    durationMinutes: number | null
    isRequired: boolean
  }): TrainingCourse {
    return new TrainingCourse({
      id: null,
      code: props.code,
      title: props.title,
      description: props.description,
      durationMinutes: props.durationMinutes,
      category: props.category,
      isRequired: props.isRequired,
      status: "active",
    })
  }

  static fromRow(row: TrainingCourseRow): TrainingCourse {
    return new TrainingCourse({
      id: row.id,
      code: row.code,
      title: row.title,
      description: row.description,
      durationMinutes: row.durationMinutes,
      category: row.category,
      isRequired: row.isRequired,
      status: row.status === "archived" ? "archived" : "active",
    })
  }

  /** 内容（タイトル・カテゴリ・説明・所要時間・必須フラグ）を変更した新しいコースを返す。code と status は保つ。 */
  withDetails(props: {
    title: string
    category: string
    description: string | null
    durationMinutes: number | null
    isRequired: boolean
  }) {
    return new TrainingCourse({
      ...this.props,
      title: props.title,
      category: props.category,
      description: props.description,
      durationMinutes: props.durationMinutes,
      isRequired: props.isRequired,
    })
  }

  archive() {
    return new TrainingCourse({ ...this.props, status: "archived" })
  }
}
