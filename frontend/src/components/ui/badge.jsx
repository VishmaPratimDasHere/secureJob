import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
    "inline-flex items-center justify-center rounded-base border-2 border-border px-2.5 py-0.5 text-xs font-base w-fit whitespace-nowrap shrink-0",
    {
        variants: {
            variant: {
                default: "bg-main text-main-foreground",
                neutral: "bg-secondary-background text-foreground",
            },
        },
        defaultVariants: { variant: "default" },
    },
)

function Badge({ className, variant, ...props }) {
    return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
