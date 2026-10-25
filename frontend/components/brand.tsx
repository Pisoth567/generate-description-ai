import Link from "next/link";
import Image from "next/image";
import logo from "../app/no background.png";
export function Brand({
  href = "/",
  collapsed = false,
}: {
  href?: string;
  collapsed?: boolean;
}) {
  return (
    <Link
      href={href}
      className="brand"
      aria-label="Generate Description AI home"
    >
      <span className={collapsed ? "w-10 max-w-full shrink-0" : "w-15"}>
        <Image src={logo} alt="" loading="eager" className="h-auto w-full" />
      </span>
      {!collapsed && <p className="text-xl">Generate</p>}
    </Link>
  );
}
