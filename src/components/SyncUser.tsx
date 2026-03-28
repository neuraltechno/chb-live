"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { useEffect, useRef } from "react";
import { api } from "../../convex/_generated/api";

export function SyncUser() {
  const { isSignedIn, user } = useUser();
  const storeUser = useMutation(api.users.store);
  const hasSynced = useRef(false);

  useEffect(() => {
    if (isSignedIn && user && !hasSynced.current) {
      console.log("Syncing user to Convex...");
      storeUser()
        .then(() => {
          hasSynced.current = true;
          console.log("User synced successfully");
        })
        .catch((err) => console.error("Failed to sync user:", err));
    }
  }, [isSignedIn, user, storeUser]);

  return null;
}
