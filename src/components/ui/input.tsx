
import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onKeyDown, onChange, ...props }, ref) => {
    // Handle number inputs: hide spinners and prevent arrow key changes
    const isNumberInput = type === "number";
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Prevent arrow keys from changing number input values
      if (isNumberInput && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        return;
      }
      // Call original onKeyDown if provided
      if (onKeyDown) {
        onKeyDown(e);
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Prevent negative values for number inputs without explicit min attribute
      // Only apply this if min is not explicitly set (undefined)
      if (isNumberInput && props.min === undefined) {
        const value = e.target.value;
        // Allow empty string and single minus (user might be typing), but prevent completed negative numbers
        if (value !== '' && value !== '-') {
          const numValue = parseFloat(value);
          // If it's a valid number and negative, prevent it
          // In controlled components (like react-hook-form), not calling onChange will prevent the value from updating
          // React will re-render with the previous value, effectively blocking the negative input
          if (!isNaN(numValue) && numValue < 0) {
            return; // Don't call onChange, so controlled value won't update
          }
        }
      }
      // Call original onChange if provided (always call for non-number inputs or when validation passes)
      // This ensures form libraries like react-hook-form receive the change event properly
      if (onChange) {
        onChange(e);
      }
    };

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive",
          // Hide spinner arrows for number inputs
          isNumberInput && "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          className
        )}
        ref={ref}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
