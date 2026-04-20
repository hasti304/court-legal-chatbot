import React from "react";

const StatusBanner = ({
  type = "info",
  children,
  className = "",
  showIcon = true,
  ...rest
}) => {
  const safeType = type === "error" ? "error" : "info";
  const classes = `status-banner ${safeType} ${className}`.trim();
  const icon = safeType === "error" ? "!" : "i";

  return (
    <div className={classes} {...rest}>
      {showIcon && (
        <span className="status-banner-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </div>
  );
};

export default StatusBanner;
