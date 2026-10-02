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
  // Icon-only: square, the icon centred. Every icon button used to be a text button
  // squeezed with `w-7 px-0`, at four slightly different sizes.
  icon: "w-7 justify-center px-0",
  "icon-sm": "h-6 w-6 justify-center px-0 text-xs",
};

/** The spinner takes the size of the text it replaces. */
const SPINNER_SIZE: Record<ButtonSize, 12 | 14> = {
  sm: 12,
  md: 14,
  lg: 14,
  icon: 14,
  "icon-sm": 12,
};

/** The one button. `className` is merged last so callers can override anything. */
export function Button({
  variant = "default",
  size = "md",
  loading,
  tooltip,
  tooltipKeys,
  tooltipSide,
  tooltipAlign,
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
      {loading && <Spinner size={SPINNER_SIZE[size]} />}
      {children}
    </button>
  );

  return tooltip ? (
    <Tooltip label={tooltip} keys={tooltipKeys} side={tooltipSide} align={tooltipAlign}>
      {el}
    </Tooltip>
  ) : (
    el
  );
}
