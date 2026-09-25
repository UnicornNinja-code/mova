import React from "react";
import clsx from "clsx";

/**
 * KopiGo Material Symbols Rounded Primitive Icon Component
 * 
 * @param {string} name - Material symbol name (e.g. 'local_cafe', 'two_wheeler', 'dashboard', 'pin_drop')
 * @param {number|string} size - Icon font size in pixels or rem (default: 20)
 * @param {boolean} filled - Whether icon glyph is solid-filled (default: false)
 * @param {number} weight - Font weight (100..700, default: 400)
 * @param {string} className - Additional CSS classes
 */
export function Icon({
  name,
  size = 20,
  filled = false,
  weight = 400,
  className = "",
  style = {},
  ...props
}) {
  const iconStyle = {
    fontSize: typeof size === "number" ? `${size}px` : size,
    width: typeof size === "number" ? `${size}px` : size,
    height: typeof size === "number" ? `${size}px` : size,
    fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' 24`,
    userSelect: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    ...style,
  };

  return (
    <span
      className={clsx(
        "material-symbols-rounded shrink-0 select-none align-middle transition-colors",
        className
      )}
      style={iconStyle}
      aria-hidden="true"
      {...props}
    >
      {name}
    </span>
  );
}

export default Icon;
