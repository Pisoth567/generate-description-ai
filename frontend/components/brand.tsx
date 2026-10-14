import Link from "next/link";
import { Sparkles } from "lucide-react";
export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="brand"
      aria-label="Generate Description AI home"
    >
      <span className="brand-mark">
        <Sparkles size={20} aria-hidden="true" />
      </span>
      <span className="brand-name">
        Generate
        <span className="block text-xs font-normal text-muted-foreground">
          Description AI
        </span>
      </span>
    </Link>
  );
}
