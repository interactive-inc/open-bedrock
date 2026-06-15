import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

/**
 * 詳細ページの戻り導線を統一する Button。PageHeader.actions に置く前提で `variant="ghost"`。
 * 全ファイルで `<Button variant="ghost" render={<Link href="..."/>}><ArrowLeft />...</Button>`
 * を書き散らさないようまとめる。
 */
type Props = {
  href: string
  label: string
}

export function BackButton(props: Props) {
  return (
    <Button variant="ghost" nativeButton={false} render={<Link href={props.href} />}>
      <ArrowLeft />
      {props.label}
    </Button>
  )
}
