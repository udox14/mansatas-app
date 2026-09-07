"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

type AccordionContextValue = {
  value: string[]
  onItemToggle: (itemValue: string) => void
  type: "single" | "multiple"
}

const AccordionContext = React.createContext<AccordionContextValue | null>(null)

export interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: "single" | "multiple"
  value?: string | string[]
  defaultValue?: string | string[]
  onValueChange?: (value: any) => void
  collapsible?: boolean
}

export const Accordion = React.forwardRef<HTMLDivElement, AccordionProps>(
  (
    {
      type = "single",
      value: valueProp,
      defaultValue,
      onValueChange,
      collapsible = true,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const isControlled = valueProp !== undefined
    const [internalValue, setInternalValue] = React.useState<string[]>(() => {
      if (defaultValue) {
        return Array.isArray(defaultValue) ? defaultValue : [defaultValue]
      }
      return []
    })

    const rawValue = isControlled
      ? Array.isArray(valueProp)
        ? valueProp
        : valueProp
        ? [valueProp]
        : []
      : internalValue

    const handleItemToggle = React.useCallback(
      (itemValue: string) => {
        let nextValue: string[]
        if (type === "single") {
          if (rawValue.includes(itemValue)) {
            nextValue = collapsible ? [] : [itemValue]
          } else {
            nextValue = [itemValue]
          }
        } else {
          if (rawValue.includes(itemValue)) {
            nextValue = rawValue.filter((v) => v !== itemValue)
          } else {
            nextValue = [...rawValue, itemValue]
          }
        }

        if (!isControlled) {
          setInternalValue(nextValue)
        }

        if (onValueChange) {
          onValueChange(type === "single" ? (nextValue[0] ?? "") : nextValue)
        }
      },
      [type, collapsible, rawValue, isControlled, onValueChange]
    )

    return (
      <AccordionContext.Provider
        value={{
          value: rawValue,
          onItemToggle: handleItemToggle,
          type,
        }}
      >
        <div ref={ref} className={cn("space-y-2", className)} {...props}>
          {children}
        </div>
      </AccordionContext.Provider>
    )
  }
)
Accordion.displayName = "Accordion"

type AccordionItemContextValue = {
  value: string
  isOpen: boolean
}

const AccordionItemContext = React.createContext<AccordionItemContextValue | null>(null)

export interface AccordionItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

export const AccordionItem = React.forwardRef<HTMLDivElement, AccordionItemProps>(
  ({ className, value, children, ...props }, ref) => {
    const accordion = React.useContext(AccordionContext)
    const isOpen = Boolean(accordion?.value.includes(value))

    return (
      <AccordionItemContext.Provider value={{ value, isOpen }}>
        <div
          ref={ref}
          data-state={isOpen ? "open" : "closed"}
          className={cn(
            "rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm transition-all",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </AccordionItemContext.Provider>
    )
  }
)
AccordionItem.displayName = "AccordionItem"

export interface AccordionTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const AccordionTrigger = React.forwardRef<HTMLButtonElement, AccordionTriggerProps>(
  ({ className, children, ...props }, ref) => {
    const accordion = React.useContext(AccordionContext)
    const item = React.useContext(AccordionItemContext)
    const isOpen = item?.isOpen ?? false

    return (
      <button
        ref={ref}
        type="button"
        data-state={isOpen ? "open" : "closed"}
        aria-expanded={isOpen}
        onClick={() => {
          if (item && accordion) {
            accordion.onItemToggle(item.value)
          }
        }}
        className={cn(
          "flex w-full items-center justify-between p-4 font-medium transition-all text-left select-none hover:bg-slate-50/70 dark:hover:bg-slate-800/40 [&[data-state=open]>svg]:rotate-180",
          className
        )}
        {...props}
      >
        <div className="flex-1 min-w-0 pr-2">{children}</div>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500 transition-transform duration-200" />
      </button>
    )
  }
)
AccordionTrigger.displayName = "AccordionTrigger"

export interface AccordionContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const AccordionContent = React.forwardRef<HTMLDivElement, AccordionContentProps>(
  ({ className, children, ...props }, ref) => {
    const item = React.useContext(AccordionItemContext)
    const isOpen = item?.isOpen ?? false

    if (!isOpen) return null

    return (
      <div
        ref={ref}
        data-state={isOpen ? "open" : "closed"}
        className={cn(
          "overflow-hidden text-sm border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-4 transition-all animate-in fade-in duration-200",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
AccordionContent.displayName = "AccordionContent"
