import { z } from "zod"

const zProps = z.object({
  id: z.number(),
  name: z.string(),
  status: z.enum(["running", "completed", "failed"]),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  message: z.string().nullable(),
})

type Props = z.infer<typeof zProps>

export class BatchJob implements Props {
  readonly id!: Props["id"]

  readonly name!: Props["name"]

  readonly status!: Props["status"]

  readonly startedAt!: Props["startedAt"]

  readonly finishedAt!: Props["finishedAt"]

  readonly message!: Props["message"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)
  }
}
