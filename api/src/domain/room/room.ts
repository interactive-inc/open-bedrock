import { z } from "zod"

const zProps = z.object({
  id: z.number(),
  name: z.string(),
  capacity: z.number(),
  location: z.string().nullable(),
})

type Props = z.infer<typeof zProps>

export class Room implements Props {
  readonly id!: Props["id"]

  readonly name!: Props["name"]

  readonly capacity!: Props["capacity"]

  readonly location!: Props["location"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)
  }
}
