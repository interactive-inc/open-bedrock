import { z } from "zod"

const zProps = z.object({
  id: z.number(),
  title: z.string(),
  category: z.string(),
  tags: z.string().nullable(),
  bodyMd: z.string(),
  authorId: z.number(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

export class KnowledgeArticle implements Props {
  readonly id!: Props["id"]

  readonly title!: Props["title"]

  readonly category!: Props["category"]

  readonly tags!: Props["tags"]

  readonly bodyMd!: Props["bodyMd"]

  readonly authorId!: Props["authorId"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)
  }
}
