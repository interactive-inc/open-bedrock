import { Terminal } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"

type Props = {
  command: string | null
}

/**
 * 読み取り専用ページの末尾に置く、変更手段の案内。
 * Company の正本は API と CLI が持ち、Web は表示だけを担うことを明示する。
 * command が null のときは対応する CLI コマンドが未実装なので、手段だけを示す。
 */
export function ReadOnlyNotice(props: Props) {
  return (
    <Alert>
      <Terminal aria-hidden="true" />

      <AlertDescription>
        この画面は読み取り専用です。変更は
        {props.command === null ? (
          " CLI から行います。"
        ) : (
          <>
            {" CLI の "}
            <code>{props.command}</code>
            {" で行います。"}
          </>
        )}
      </AlertDescription>
    </Alert>
  )
}
