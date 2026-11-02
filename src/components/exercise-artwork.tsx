import { useId, type ImgHTMLAttributes } from "react";

/** Display-only brand palette; source files and movement geometry remain unchanged. */
export function ExerciseArtwork({
  branded = false,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { branded?: boolean }) {
  const id = useId();
  return (
    <>
      {branded && (
        <svg width="0" height="0" className="absolute" aria-hidden="true">
          <defs>
            <filter id={id} colorInterpolationFilters="sRGB">
              <feColorMatrix
                in="SourceGraphic"
                type="matrix"
                values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -0.2126 -0.7152 -0.0722 1 0"
                result="ink"
              />
              <feFlood floodColor="#CBD5E1" result="silver" />
              <feComposite in="silver" in2="ink" operator="in" result="linework" />
              <feColorMatrix
                in="SourceGraphic"
                type="matrix"
                values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 -0.5 -0.5 0 0"
                result="target"
              />
              <feComponentTransfer in="target" result="targetMask">
                <feFuncA type="linear" slope="2" />
              </feComponentTransfer>
              <feFlood floodColor="#D4AF37" result="gold" />
              <feComposite in="gold" in2="targetMask" operator="in" result="highlight" />
              <feMerge>
                <feMergeNode in="linework" />
                <feMergeNode in="highlight" />
              </feMerge>
            </filter>
          </defs>
        </svg>
      )}
      <img {...props} style={{ ...props.style, ...(branded ? { filter: `url(#${id})` } : {}) }} />
    </>
  );
}
