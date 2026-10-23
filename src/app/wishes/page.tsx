import type { Metadata } from "next";
import { WishesView } from "./wishes-view";

export const metadata: Metadata = {
  title: "Tansu & Arda — Anı Defteri · Guestbook",
};

export default function WishesPage() {
  return <WishesView />;
}
