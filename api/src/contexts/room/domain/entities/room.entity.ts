import type { RoomRow } from "@/contexts/room/infrastructure/schema/room"
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

    Object.freeze(this)
  }

  /** 永続化された行から復元する。 */
  static fromRow(row: RoomRow): Room {
    return new Room({
      id: row.id,
      name: row.name,
      capacity: row.capacity,
      location: row.location,
    })
  }

  /** 名称・定員・所在地を差し替える。id は保つ。 */
  withDetails(details: {
    name: Props["name"]
    capacity: Props["capacity"]
    location: Props["location"]
  }) {
    return new Room({
      ...this.props,
      name: details.name,
      capacity: details.capacity,
      location: details.location,
    })
  }
}
