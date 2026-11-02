import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "./ui/button";
export function PrivatePhoto({
  url,
  alt,
  className,
  onRenew,
}: {
  url: string | null;
  alt: string;
  className?: string;
  onRenew: () => void;
}) {
  const { locale } = useI18n();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const renewed = useRef(false);
  useEffect(() => setFailed(false), [url]);
  return (
    <div className={className}>
      {url && (
        <img
          key={`${url}:${attempt}`}
          src={url}
          alt={alt}
          className={`h-full w-full object-contain ${failed ? "hidden" : ""}`}
          loading="lazy"
          onError={() => {
            setFailed(true);
            if (!renewed.current) {
              renewed.current = true;
              onRenew();
            }
          }}
        />
      )}{" "}
      {(!url || failed) && (
        <div
          role="alert"
          className="flex h-full min-h-28 flex-col items-center justify-center gap-2 p-2 text-center text-xs text-muted-foreground"
        >
          <span>{locale === "ar" ? "تعذر عرض الصورة." : "Photo could not be displayed."}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFailed(false);
              setAttempt((n) => n + 1);
              onRenew();
            }}
          >
            {locale === "ar" ? "إعادة تحميل الصورة" : "Retry photo"}
          </Button>
        </div>
      )}
    </div>
  );
}
