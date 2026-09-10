import React, { useState } from "react";
import { ShieldCheck } from "lucide-react";

interface BrandLogoProps {
  className?: string;
  fallbackClassName?: string;
  alt?: string;
}

export function BrandLogo({
  className = "h-8 w-auto object-contain",
  fallbackClassName = "h-8 w-8 rounded-lg bg-brand-orange-soft text-brand-orange flex items-center justify-center font-display font-bold text-xs",
  alt = "Apex Security Ltd Logo"
}: BrandLogoProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className={fallbackClassName} title={alt} aria-label={alt}>
        <ShieldCheck className="h-5 w-5 text-brand-orange" />
      </div>
    );
  }

  return (
    <img
      src="/logo.png"
      alt={alt}
      className={className}
      onError={() => setHasError(true)}
      loading="eager"
    />
  );
}
