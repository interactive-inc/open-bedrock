export type Props = {
  clockInAt: string
  clockOutAt: string
}

export function toWorkMinutes(props: Props): number {
  const startMs = Date.parse(props.clockInAt)

  const endMs = Date.parse(props.clockOutAt)

  const diffMinutes = Math.round((endMs - startMs) / 60000)

  if (diffMinutes < 0) {
    return 0
  }

  return diffMinutes
}
