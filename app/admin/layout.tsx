import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Researcher Panel · Go-on Lab",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
