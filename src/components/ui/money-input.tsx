"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface MoneyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: string | number;
  onChange: (val: string) => void;
}

export function MoneyInput({ value, onChange, className, ...props }: MoneyInputProps) {
  const [displayValue, setDisplayValue] = useState("");

  useEffect(() => {
    if (value === "" || value === undefined || value === null) {
      setDisplayValue("");
      return;
    }
    
    const numericVal = value.toString().replace(/[^0-9]/g, "");
    if (numericVal === "") {
        setDisplayValue("");
        return;
    }

    const formatted = numericVal.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    setDisplayValue(formatted);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/[^0-9]/g, "");
    onChange(rawVal);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      className={cn("input font-mono tracking-wide", className)}
      value={displayValue}
      onChange={handleChange}
      {...props}
    />
  );
}
