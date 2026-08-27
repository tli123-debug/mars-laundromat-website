"use client"

import * as React from "react"
import { NavigationMenu as NavigationMenuPrimitive } from "radix-ui"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function NavigationMenu({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Root>) {
  return (
    <NavigationMenuPrimitive.Root
      data-slot="navigation-menu"
      className={cn("relative flex items-center", className)}
      {...props}
    />
  )
}

function NavigationMenuList({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.List>) {
  return (
    <NavigationMenuPrimitive.List
      data-slot="navigation-menu-list"
      className={cn("flex list-none items-center gap-8", className)}
      {...props}
    />
  )
}

function NavigationMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Item>) {
  return (
    <NavigationMenuPrimitive.Item
      data-slot="navigation-menu-item"
      className={cn("relative", className)}
      {...props}
    />
  )
}

function NavigationMenuTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Trigger>) {
  return (
    <NavigationMenuPrimitive.Trigger
      data-slot="navigation-menu-trigger"
      className={cn(
        "group flex items-center gap-1 rounded-md text-sm font-medium text-foreground/80 outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-open:text-foreground",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon
        aria-hidden="true"
        className="size-3.5 transition-transform duration-200 group-data-open:rotate-180"
      />
    </NavigationMenuPrimitive.Trigger>
  )
}

function NavigationMenuContent({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Content>) {
  return (
    <NavigationMenuPrimitive.Content
      data-slot="navigation-menu-content"
      className={cn(
        "absolute top-full left-1/2 mt-3 w-64 -translate-x-1/2 rounded-xl bg-popover p-2 text-popover-foreground ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
        className
      )}
      {...props}
    />
  )
}

// This installed Radix version's Link renders a plain <a> with no `asChild`
// escape hatch, so it can't wrap next/link for client-side transitions —
// it's used directly, with `href` passed straight through (see header.tsx).
// That's the deliberate tradeoff: NavigationMenuContent scopes focus and
// sets tabIndex=-1 on any descendant Radix doesn't recognize as part of its
// own roving-tabindex system, so a plain next/link inside it is visible but
// completely unreachable by keyboard (confirmed while testing this menu) —
// only NavigationMenuLink is wired into that system correctly.
function NavigationMenuLink({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Link>) {
  return (
    <NavigationMenuPrimitive.Link
      data-slot="navigation-menu-link"
      className={cn(
        "block rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/80 no-underline outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground data-active:bg-muted data-active:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
}
