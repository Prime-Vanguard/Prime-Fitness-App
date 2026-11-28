import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";

// Keep the English brand name left-to-right, including inside Arabic layouts.
export function BrandLockup({ rail = false }: { rail?: boolean }) {
  return (
    <div
      dir="ltr"
      lang="en"
      className={cn(
        "flex min-w-0 items-center gap-2",
        rail && "md:justify-center lg:justify-start",
      )}
    >
      <img
        src={logo}
        alt="Prime Vanguard"
        width={32}
        height={32}
        className="size-8 shrink-0 rounded-lg bg-[#F1F5F9] object-contain"
      />
      <span
        className={cn(
          "min-w-0 whitespace-nowrap font-display text-xl font-extrabold leading-none",
          rail && "md:hidden lg:block",
        )}
      >
        Prime <span className="text-gold">Fitness</span>
      </span>
    </div>
  );
}
