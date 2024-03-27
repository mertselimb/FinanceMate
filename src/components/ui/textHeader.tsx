import React from "react";
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const textHeaderVariants = cva(
    "tw-scroll-m-20 tw-tracking-tight tw-m-3",
    {
        variants: {
            variant: {
                h1: "tw-text-3xl tw-font-extrabold",
                h2: "tw-text-2xl tw-font-semibold tw-border-b tw-pb-2 first:tw-mt-0",
                h3: "tw-text-xl tw-font-semibold",
                h4: "tw-text-l tw-font-semibold",
            },
            size: {
                default: "",
                sm: "tw-text-sm",
                md: "tw-text-md",
                lg: "tw-text-lg",
                xl: "tw-text-xl",
                _2xl: "tw-text-2xl",
                _3xl: "tw-text-3xl",
                _4xl: "tw-text-4xl",
                _5xl: "tw-text-5xl",
                _6xl: "tw-text-6xl",
            },
        },
        defaultVariants: {
            variant: "h1",
            size: "default",
        },
    }
)

export interface HeaderProps
    extends React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof textHeaderVariants> {
    asChild?: boolean
}
const TextHeader = React.forwardRef<HTMLHeadingElement, HeaderProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {

        const Comp = asChild ? Slot : (variant ? variant : "h1")
        return (
            <Comp
                className={cn(textHeaderVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        )
    }
)
TextHeader.displayName = "TextHeader"

export { TextHeader, textHeaderVariants }
