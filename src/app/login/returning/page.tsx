"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ReturningPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login?tab=login");
  }, [router]);

  return null;
}
