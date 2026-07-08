"use client"

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"

function Collapsible({
  className,
  ...props
}: CollapsiblePrimitive.Root.Props & { className?: string }) {
  return (
    <CollapsiblePrimitive.Root
      data-slot="collapsible"
      className={`group/collapsible ${className ?? ""}`.trim()}
      {...props}
    />
  )
}

function CollapsibleTrigger({ ...props }: CollapsiblePrimitive.Trigger.Props) {
  return <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />
}

function CollapsibleContent({ ...props }: CollapsiblePrimitive.Panel.Props) {
  return <CollapsiblePrimitive.Panel data-slot="collapsible-content" keepMounted {...props} />
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
