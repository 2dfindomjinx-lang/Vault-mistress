"use client";

import { useState, type CSSProperties } from "react";

type CoinAmountProps = {
  amount: number | string;
  className?: string;
  iconClassName?: string;
  iconSize?: number;
  label?: string;
  prefix?: string;
  suffix?: string;
  style?: CSSProperties;
};

const COIN_ICON_SRC = "/icons/coin.png";

export function CoinAmount({
  amount,
  className = "",
  iconClassName = "",
  iconSize = 18,
  label = "Coins",
  prefix = "",
  suffix,
  style,
}: CoinAmountProps) {
  const [iconFailed, setIconFailed] = useState(false);
  const formattedAmount =
    typeof amount === "number" ? amount.toLocaleString() : amount;
  const visibleSuffix = suffix ?? (label ? ` ${label}` : "");

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} style={style}>
      {!iconFailed && (
        // Plain img keeps the app ready even before the asset exists in /public/icons.
        // It will appear automatically once public/icons/coin.png is added.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          aria-hidden="true"
          className={`shrink-0 object-contain ${iconClassName}`}
          height={iconSize}
          onError={() => setIconFailed(true)}
          src={COIN_ICON_SRC}
          width={iconSize}
        />
      )}
      <span>
        {prefix}
        {formattedAmount}
        {visibleSuffix}
      </span>
    </span>
  );
}
