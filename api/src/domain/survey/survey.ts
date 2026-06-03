import type { SurveyRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  title: z.string(),
  status: z.enum(["open", "closed"]),
  questionsJson: z.array(z.unknown()).readonly(),
})

type Props = z.infer<typeof zProps>

// アンケート（設問定義と公開状態）。集約ルート。
export class Survey implements Props {
  // 永続化前は null、DB 採番後に確定する。
  readonly id!: Props["id"]

  readonly title!: Props["title"]

  readonly status!: Props["status"]

  readonly questionsJson!: Props["questionsJson"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  // 新規作成するアンケートを組み立てる。id は未採番。
  static create(props: {
    title: string
    status: "open" | "closed"
    questionsJson: ReadonlyArray<unknown>
  }): Survey {
    return new Survey({
      id: null,
      title: props.title,
      status: props.status,
      questionsJson: props.questionsJson,
    })
  }

  static fromRow(row: SurveyRow): Survey {
    return new Survey({
      id: row.id,
      title: row.title,
      status: row.status === "open" ? "open" : "closed",
      questionsJson: JSON.parse(row.questionsJson),
    })
  }

  // 内容（タイトル・状態・設問）を変更した新しいアンケートを返す。id は保つ。
  withDetails(props: {
    title: string
    status: "open" | "closed"
    questionsJson: ReadonlyArray<unknown>
  }) {
    return new Survey({
      ...this.props,
      title: props.title,
      status: props.status,
      questionsJson: props.questionsJson,
    })
  }

  isOpen() {
    return this.props.status === "open"
  }
}
