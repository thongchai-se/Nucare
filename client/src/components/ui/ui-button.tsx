"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  UI_BUTTON_DANGER,
  UI_BUTTON_FULL_WIDTH,
  UI_BUTTON_GHOST,
  UI_BUTTON_PRIMARY,
  UI_BUTTON_SECONDARY,
  UI_BUTTON_SUCCESS,
} from "@/lib/ui-classes";

type UiButtonVariant = "primary" | "secondary" | "danger" | "success" | "ghost";

type UiButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: UiButtonVariant;
  icon?: ReactNode;
  fullWidth?: boolean;
};

const variantClassMap: Record<UiButtonVariant, string> = {
  primary: UI_BUTTON_PRIMARY,
  secondary: UI_BUTTON_SECONDARY,
  danger: UI_BUTTON_DANGER,
  success: UI_BUTTON_SUCCESS,
  ghost: UI_BUTTON_GHOST,
};

export function UiButton({
  variant = "primary",
  icon,
  fullWidth = false,
  className = "",
  children,
  type = "button",
  ...props
}: UiButtonProps) {
  return (
    <button
      type={type}
      className={`${variantClassMap[variant]} ${fullWidth ? UI_BUTTON_FULL_WIDTH : ""} ${className}`.trim()}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
