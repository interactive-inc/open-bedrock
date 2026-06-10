export type Props = {
  clockInAt: string
  clockOutAt: string
}

export function toWorkMinutes(props: Props): number | Error {
  const startMs = Date.parse(props.clockInAt)

  if (Number.isNaN(startMs)) {
    return new Error(`invalid clockInAt: ${props.clockInAt}`)
  }

  const endMs = Date.parse(props.clockOutAt)

  if (Number.isNaN(endMs)) {
    return new Error(`invalid clockOutAt: ${props.clockOutAt}`)
  }

  const diffMinutes = Math.round((endMs - startMs) / 60000)

  if (diffMinutes < 0) {
    return new Error("clockOutAt is before clockInAt")
  }

  return diffMinutes
}
