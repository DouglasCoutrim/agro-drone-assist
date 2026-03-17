import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchableInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  onAddNew?: (value: string) => void;
  addNewLabel?: string;
  className?: string;
  required?: boolean;
}

export function SearchableInput({
  value,
  onChange,
  suggestions,
  placeholder,
  onAddNew,
  addNewLabel = "Adicionar",
  className,
  required,
}: SearchableInputProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = suggestions.filter((s) =>
    s.toLowerCase().includes(inputValue.toLowerCase())
  );

  const exactMatch = suggestions.some(
    (s) => s.toLowerCase() === inputValue.toLowerCase()
  );

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <Input
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        required={required}
      />
      {open && inputValue.length > 0 && (filtered.length > 0 || !exactMatch) && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-md max-h-48 overflow-y-auto">
          {filtered.map((item) => (
            <button
              key={item}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              onClick={() => {
                setInputValue(item);
                onChange(item);
                setOpen(false);
              }}
            >
              {item}
            </button>
          ))}
          {!exactMatch && inputValue.trim() && onAddNew && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2 text-primary border-t border-border"
              onClick={() => {
                onAddNew(inputValue.trim());
                setOpen(false);
              }}
            >
              <Plus className="h-3 w-3" />
              {addNewLabel} "{inputValue.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}
