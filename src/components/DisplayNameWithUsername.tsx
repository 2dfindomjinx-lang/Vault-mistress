import type { CSSProperties } from "react";
import { getDisplayNameOrUsername } from "@/lib/display-name";

type DisplayNameWithUsernameProps = {
  displayName?: string | null;
  username: string;
  className?: string;
  primaryClassName?: string;
  secondaryClassName?: string;
  primaryStyle?: CSSProperties;
  secondaryStyle?: CSSProperties;
};

export function DisplayNameWithUsername({
  className = "",
  displayName,
  primaryClassName = "text-sm font-black text-white",
  primaryStyle,
  secondaryClassName = "text-[11px] font-semibold text-zinc-400",
  secondaryStyle,
  username,
}: DisplayNameWithUsernameProps) {
  const hasDisplayName = Boolean(displayName && displayName.trim().length > 0);
  const primary = getDisplayNameOrUsername(displayName, username);
  const secondary = username.startsWith("@") ? username : `@${username}`;

  return (
    <span className={`flex min-w-0 flex-col ${className}`}>
      <span className={`truncate ${primaryClassName}`} style={primaryStyle}>
        {primary}
      </span>
      {hasDisplayName ? (
        <span className={`truncate ${secondaryClassName}`} style={secondaryStyle}>
          {secondary}
        </span>
      ) : null}
    </span>
  );
}
