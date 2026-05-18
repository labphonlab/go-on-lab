import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Audio Perception Experiment · Go-on Lab",
  description:
    "Frequency discrimination experiment using a 2-interval forced-choice adaptive staircase procedure.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function ExperimentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
