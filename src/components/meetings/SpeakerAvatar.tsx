import { useState } from "react";
import { getAvatarColor, getAvatarInitial, isImageUrlFailed, markImageUrlFailed } from "./speakerAvatarUtils";

export interface SpeakerAvatarProps {
  name: string;
  photoURL?: string | null;
  className?: string;
  textClassName?: string;
  ringClassName?: string;
  alt?: string;
}

export function SpeakerAvatar({
  name,
  photoURL,
  className = "h-9 w-9 rounded-xl",
  textClassName = "text-xs font-bold",
  ringClassName = "ring-1 ring-slate-200 shrink-0 shadow-2xs",
  alt,
}: SpeakerAvatarProps) {
  const normalizedUrl = (photoURL || "").trim();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const isInvalid =
    !normalizedUrl ||
    normalizedUrl === "null" ||
    normalizedUrl === "undefined" ||
    normalizedUrl === "false" ||
    failedUrl === normalizedUrl ||
    isImageUrlFailed(normalizedUrl);

  const palette = getAvatarColor(name);
  const initial = getAvatarInitial(name);

  if (!isInvalid) {
    return (
      <img
        src={normalizedUrl}
        alt={alt !== undefined ? alt : name}
        onError={() => {
          markImageUrlFailed(normalizedUrl);
          setFailedUrl(normalizedUrl);
        }}
        className={`${className} object-cover ${ringClassName}`}
      />
    );
  }

  return (
    <span
      className={`grid place-items-center shrink-0 border select-none ${palette.bg} ${palette.text} ${palette.border} ${className} ${textClassName}`}
    >
      {initial}
    </span>
  );
}

export const UserAvatar = SpeakerAvatar;

