import Link from "next/link";
export default function NotFound() {
  return (
    <>
      <h1>Description not found</h1>
      <Link href="/history">Back to history</Link>
    </>
  );
}
