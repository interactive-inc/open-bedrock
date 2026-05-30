export type Props = {
  startAt: string
  endAt: string
  otherStartAt: string
  otherEndAt: string
}

export function hasTimeOverlap(props: Props): boolean {
  return props.otherStartAt < props.endAt && props.startAt < props.otherEndAt
}
