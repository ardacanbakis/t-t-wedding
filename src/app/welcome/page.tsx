import type { Metadata } from "next";
import { WelcomeLoader } from "./welcome-loader";

export const metadata: Metadata = {
  title: "Tansu & Arda — Davetiye",
};

export default function WelcomePage() {
  return <WelcomeLoader />;
}
