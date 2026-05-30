import type { SurveyRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number(),
  title: z.string(),
  status: z.enum(["open", "closed"]),
  questionsJson: z.array(z.unknown()).readonly(),
})

type Props = z.infer<typeof zProps>

// アンケート（設問定義と公開状態）。集約ルート。
export class Survey implements Props {
  readonly id!: Props["id"]

  readonly title!: Props["title"]

  readonly status!: Props["status"]

  readonly questionsJson!: Props["questionsJson"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  static fromRow(row: SurveyRow): Survey {
    return new Survey({
      id: row.id,
      title: row.title,
      status: row.status === "open" ? "open" : "closed",
      questionsJson: JSON.parse(row.questionsJson),
    })
  }

  isOpen() {
    return this.props.status === "open"
  }
}
