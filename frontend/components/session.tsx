"use client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api, ApiError } from "@/lib/api";
import type { User } from "@/lib/types";
export function useSession() {
  const router = useRouter();
  const query = useQuery({
    queryKey: ["session"],
    queryFn: ({ signal }) => api<User>("/auth/session", { signal }),
    retry: false,
  });
  useEffect(() => {
    if (query.error instanceof ApiError && query.error.status === 401)
      router.replace("/login");
  }, [query.error, router]);
  return query;
}
