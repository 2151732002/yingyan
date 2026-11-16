"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, ChevronRight, BookOpen } from "lucide-react";
import { Brand } from "./ui";
import { api } from "@/lib/api";
export function Topbar({
  name,
  children,
}: {
  name?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const client = useQueryClient();
  async function logout() {
    await client.cancelQueries();
    await api("/auth/logout", { method: "POST" });
    client.clear();
    router.replace("/login");
  }
  return (
    <header className="topbar">
      <Link href="/projects" className="topbar-brand">
        <Brand />
      </Link>
      <div className="breadcrumbs">
        <Link href="/projects">创作空间</Link>
        <ChevronRight size={13} />
        <span>{name || "我的故事"}</span>
      </div>
      <div className="topbar-actions">
        {children}
        <span className="stage-label">
          <span />
          创作工作台
        </span>
        <button
          className="icon-btn logout"
          aria-label="退出登录"
          onClick={() => void logout()}
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="page-footer">
      <span>© 2026 映言 YINGYAN</span>
      <span>
        <BookOpen size={12} /> 认真对待，每一个还没被讲述的故事。
      </span>
    </footer>
  );
}
