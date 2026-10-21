import Link from "next/link";
import Image from "next/image";
import logo from "../app/no background.png";
export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="brand"
      aria-label="Generate Description AI home">
      <span className="w-15">
        <Image src={logo} alt="" loading="eager" />
      </span>
      <p className="text-xl">
        Generate
      </p>
    </Link>
  );
}
