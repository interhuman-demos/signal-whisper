import { type VariantProps, cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const spinnerVariants = cva("relative inline-block", {
  variants: {
    size: {
      sm: "size-4",
      md: "size-5",
      lg: "size-6",
    },
  },
  defaultVariants: { size: "md" },
});

const BARS = Array.from({ length: 12 });

function Spinner({
  className,
  size,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof spinnerVariants>) {
  return (
    <span
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      className={cn(spinnerVariants({ size, className }))}
      {...props}
    >
      {BARS.map((_, i) => (
        <span
          key={i}
          className="absolute left-1/2 top-1/2 h-[30%] w-[8%] -translate-x-1/2 origin-[center_167%] rounded-full bg-current motion-safe:animate-[spinner-fade_1s_linear_infinite]"
          style={{
            transform: `translate(-50%, -50%) rotate(${i * 30}deg) translateY(-110%)`,
            animationDelay: `${(i / 12) * -1}s`,
          }}
        />
      ))}
    </span>
  );
}

export { Spinner };
