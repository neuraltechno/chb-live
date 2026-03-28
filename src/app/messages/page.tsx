"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDMStore } from "@/lib/store";

/** In-app DMs live in a slide-over panel, not a dedicated URL. This route exists so
 * bookmarks or bad redirects to /messages open the panel instead of a 404. */
export default function MessagesPage() {
  const router = useRouter();
  const openDM = useDMStore((s) => s.openDM);

  useEffect(() => {
    openDM();
    router.replace("/");
  }, [openDM, router]);

  return (
    <div className="py-24 flex justify-center text-dark-500 text-sm">
      Opening messages…
    </div>
  );
}
