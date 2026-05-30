type Props = {
  kind: string
}

// 物品の種別コードを日本語ラベルへ変換して表示する。未知の値はそのまま出す。
export function AssetKindLabel(props: Props) {
  if (props.kind === "pc") {
    return <span>PC</span>
  }

  if (props.kind === "monitor") {
    return <span>モニター</span>
  }

  if (props.kind === "furniture") {
    return <span>什器</span>
  }

  if (props.kind === "other") {
    return <span>その他</span>
  }

  return <span>{props.kind}</span>
}
