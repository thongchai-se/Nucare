"use client";

import { UI_CHIP_ACTIVE, UI_CHIP_INACTIVE, UI_SECTION_LABEL } from "@/lib/ui-classes";

export type UiChipOption<T extends string> = {
  value: T;
  label: string;
};

type UiChipGroupProps<T extends string> = {
  options: Array<UiChipOption<T>>;
  value: T;
  onChange: (value: T) => void;
  label?: string;
  className?: string;
};

export function UiChipGroup<T extends string>({
  options,
  value,
  onChange,
  label,
  className = "",
}: UiChipGroupProps<T>) {
  return (
    <div className={`w-full min-w-0 ${className}`}>
      {label ? <p className={`mb-2 ${UI_SECTION_LABEL}`}>{label}</p> : null}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
        {options.map((option) => {
          const isActive = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={isActive ? UI_CHIP_ACTIVE : UI_CHIP_INACTIVE}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
