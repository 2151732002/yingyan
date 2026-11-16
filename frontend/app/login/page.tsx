"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Clapperboard, LoaderCircle, Quote } from "lucide-react";
import { Brand, ErrorMessage } from "@/components/ui";
import { send } from "@/lib/api";
import type { User } from "@/lib/types";
export default function Login() {
  const [username, setUsername] = useState("director");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const client = useQueryClient();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const user = await send<User>("/auth/login", { username, password });
      client.clear();
      client.setQueryData(["session"], user);
      router.replace("/projects");
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败");
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-visual">
        <Brand />
        <div className="login-film">
          <span className="film-label">EVERY STORY STARTS WITH A WORD.</span>
          <div className="film-window">
            <span className="window-grid" />
            <span className="film-rain" />
            <span className="film-chair left" />
            <span className="film-chair right" />
            <span className="film-table" />
            <div className="film-caption">
              <Quote size={22} />
              <p>“你真的要走？”</p>
              <small>场景 01 / 雨夜 / 咖啡馆</small>
            </div>
          </div>
          <div className="film-dots">
            <i />
            <i />
            <i />
          </div>
        </div>
        <div className="login-tagline">
          <h1>
            让故事中的人，
            <br />
            <em>开口说话。</em>
          </h1>
          <p>从一个念头，到一段值得被看见的故事。</p>
        </div>
        <span className="login-copyright">映言创作工作台 · 第一阶段</span>
      </section>
      <section className="login-form-panel">
        <div className="login-form">
          <span className="eyebrow">YOUR DIRECTOR&apos;S ROOM</span>
          <h2>欢迎回到映言</h2>
          <p className="muted">留一个位置，给你还没讲完的故事。</p>
          <form onSubmit={submit}>
            <label>
              账号
              <input
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                maxLength={64}
              />
            </label>
            <label>
              密码
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                maxLength={72}
                placeholder="输入你的创作账号密码"
              />
            </label>
            {error && <ErrorMessage message={error} />}
            <button className="btn primary login-submit" disabled={pending}>
              {pending ? (
                <LoaderCircle size={17} className="spin" />
              ) : (
                <Clapperboard size={17} />
              )}
              进入创作空间
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="login-note">
            <span />
            内测创作空间，使用管理员配置的账号登录。
          </div>
        </div>
        <footer>故事 · 角色 · 分镜 · 版本</footer>
      </section>
    </main>
  );
}
