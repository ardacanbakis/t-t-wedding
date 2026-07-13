import type { Metadata } from "next";
import { Suspense } from "react";
import { InviteLoader } from "./invite-loader";

export const metadata: Metadata = {
  title: "Tansu & Arda — Davetiye",
};

export default function InvitePage() {
  return (
    <Suspense fallback={null}>
      <InviteLoader />
    </Suspense>
  );
}
