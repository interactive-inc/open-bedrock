type Props = {
  children: React.ReactNode
}

// じぶん領域の薄いレイアウト。各 /me/* ページは自前の見出しを持つため、
// ここでは共通ラッパのみを提供して余計なヘッダを重ねない。
export default function MeLayout(props: Props) {
  return <div className="flex flex-col gap-6">{props.children}</div>
}
