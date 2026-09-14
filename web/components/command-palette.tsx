"use client"

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { getAdminNavigationItems } from "@/lib/feature/get-admin-navigation-items"
import { getFeatureNavigationSections } from "@/lib/feature/get-feature-navigation-sections"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

type Props = {
  permissions: ReadonlyArray<string>
  disabledFeatures: ReadonlyArray<string>
}

/** 管理ナビゲーションと同じ項目だけを検索する。 */
export function CommandPalette(props: Props) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const sections = getFeatureNavigationSections(
    getAdminNavigationItems(props.permissions, props.disabledFeatures),
  )
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])
  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="管理機能を検索"
      description="閲覧できる管理機能に移動"
    >
      <Command>
        <CommandInput placeholder="管理機能を検索…" />
        <CommandList>
          <CommandEmpty>見つかりません</CommandEmpty>
          {sections.map((section) => (
            <CommandGroup key={section.heading} heading={section.heading}>
              {section.items.map((item) => (
                <CommandItem
                  key={item.href}
                  onSelect={() => {
                    setOpen(false)
                    router.push(item.href)
                  }}
                >
                  <item.icon aria-hidden="true" />
                  <span>{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
