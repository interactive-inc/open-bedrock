// クエリ文字列を [min, max] に丸める。未指定・非数・min 未満は fallback。
// limit は min:1（0 を空一覧でなく既定にフォールバック）、offset は min:0（0 を正当値として維持）。
export function toBoundedInt(props: {
  raw: string | undefined
  fallback: number
  min: number
  max: number
}): number {
  if (props.raw === undefined) {
    return props.fallback
  }

  const parsed = Number.parseInt(props.raw, 10)

  if (Number.isNaN(parsed) || parsed < props.min) {
    return props.fallback
  }

  return parsed > props.max ? props.max : parsed
}
