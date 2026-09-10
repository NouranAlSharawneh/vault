import { cx } from "@/helpers";
import { Spinner } from "../spinner/spinner.component";
import type { ButtonProps, ButtonVariant } from "./button.types";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  default: "",
  primary: "btn-primary",
  ghost: "btn-ghost",
  outline: "btn-outline",
};

export function Button({
  variant = "default",
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cx("btn", VARIANT_CLASS[variant], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
