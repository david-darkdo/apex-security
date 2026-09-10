import React, { useState } from "react";

const CANONICAL_LOGO_URL = "/apex-logo.png?v=apex-2026-v1";
const SECONDARY_LOGO_URL = "/logo.png?v=apex-2026-v1";

interface BrandLogoProps {
  className?: string;
  fallbackClassName?: string;
  alt?: string;
}

export function BrandLogo({
  className = "h-8 w-auto object-contain",
  fallbackClassName = "h-8 w-auto object-contain",
  alt = "Apex Security Ltd Logo"
}: BrandLogoProps) {
  const [imgSrc, setImgSrc] = useState(CANONICAL_LOGO_URL);

  const handleError = () => {
    if (imgSrc === CANONICAL_LOGO_URL) {
      setImgSrc(SECONDARY_LOGO_URL);
    }
  };

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      onError={handleError}
      loading="eager"
      decoding="async"
    />
  );
}

