import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "映言 · 让故事中的人开口说话", template: "%s · 映言" },
  description:
    "中文写实剧情创作工作台。从故事、角色到分镜，认真打磨每一句对白。",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
