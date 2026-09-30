import * as React from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

interface NumberInputProps extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
  value: number;
  onChange: (value: number) => void;
}

/**
 * Number input that:
 * - Shows empty when value is 0 (so placeholder shows)
 * - Selects all on focus (so typing replaces existing value)
 * - Falls back to 0 on blur if empty
 */
export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onChange, className, ...props }, ref) => {
    const [text, setText] = React.useState<string>(value === 0 ? "" : String(value));

    // Sync from outside when value changes externally
    React.useEffect(() => {
      const numText = parseFloat(text);
      if (Number.isNaN(numText) ? value !== 0 : numText !== value) {
        setText(value === 0 ? "" : String(value));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    return (
      <Input
        ref={ref}
        type="number"
        inputMode="decimal"
        value={text}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          const n = parseFloat(v);
          onChange(Number.isNaN(n) ? 0 : n);
        }}
        onBlur={(e) => {
          if (e.target.value === "") {
            setText("");
            onChange(0);
          }
          props.onBlur?.(e);
        }}
        className={cn(className)}
        {...props}
      />
    );
  }
);
NumberInput.displayName = "NumberInput";
