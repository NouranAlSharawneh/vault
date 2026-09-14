import { cx } from "@/helpers";
import { Spinner } from "../spinner/spinner.component";
import { Tooltip } from "../tooltip/tooltip.component";
import type { ButtonProps, ButtonSize, ButtonVariant } from "./button.types";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  default: "btn",
  primary: "btn btn-primary",
  outline: "btn btn-outline",
  ghost: "btn btn-ghost",
  link: "btn-link",
  subtle: "btn-link btn-subtle",
  danger: "btn btn-danger",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "h-6 px-2 text-xs",
  md: "",
  lg: "h-9 px-4 text-base",
};

/** The one button. `className` is merged last so callers can override anything. */
export function Button({
  variant = "default",
  size = "md",
  loading,
  tooltip,
  tooltipKeys,
  tooltipSide,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const inline = variant === "link" || variant === "subtle";
  const el = (
    <button
      type={type}
      className={cx(VARIANT_CLASS[variant], !inline && SIZE_CLASS[size], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
  return tooltip ? (
    <Tooltip label={tooltip} keys={tooltipKeys} side={tooltipSide}>
      {el}
    </Tooltip>
  ) : (
    el
  );
}
