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
      <span className={cn("min-w-0 font-heading leading-tight", rail && "md:hidden lg:block")}>
        <span className="block whitespace-nowrap text-[11px] font-extrabold tracking-[0.06em]">
          PRIME VANGUARD
        </span>
        <span className="mt-0.5 block text-[9px] font-bold tracking-[0.18em] text-gold">
          PRIME FITNESS
        </span>
      </span>
    </div>
  );
}
