"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowDownWideNarrow,
  ArrowUpRight,
  Archive,
  BookOpen,
  Clapperboard,
  Film,
  FolderOpen,
  Plus,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useSession } from "@/components/session";
import { Topbar, Footer } from "@/components/topbar";
import { Modal, ErrorMessage, Loading } from "@/components/ui";
import { api, date, send } from "@/lib/api";
import type { Project } from "@/lib/types";

export default function Projects() {
  const session = useSession();
  const router = useRouter();
  const [archived, setArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const query = useQuery({
    queryKey: ["projects", archived],
    queryFn: ({ signal }) =>
      api<Project[]>(`/projects?archived=${archived}`, { signal }),
    enabled: !!session.data,
  });
  if (session.isPending) return <Loading />;
  if (!session.data)
    return (
      <div className="standalone-error">
        {session.error && <ErrorMessage message={session.error.message} />}
      </div>
    );
  const projects = (query.data || []).filter((p) =>
    `${p.title}${p.logline}`.includes(search),
  );
  return (
    <>
      <Topbar />
      <div className="library-layout">
        <aside className="library-sidebar">
          <div className="sidebar-caption">WORKSPACE / 工作空间</div>
          <nav>
            <button
              className={!archived ? "selected" : ""}
              onClick={() => setArchived(false)}
            >
              <FolderOpen size={17} />
              我的故事<span>{!archived ? query.data?.length || 0 : ""}</span>
            </button>
            <button
              className={archived ? "selected" : ""}
              onClick={() => setArchived(true)}
            >
              <Archive size={17} />
              已归档项目
            </button>
          </nav>
          <div className="sidebar-inspiration">
            <Sparkles size={21} />
            <h3>好故事，值得慢慢打磨。</h3>
            <p>
              给角色一个声音，
              <br />
              给每场相遇一个镜头。
            </p>
            <button onClick={() => setCreating(true)}>
              开始新故事
              <ArrowUpRight size={13} />
            </button>
          </div>
          <details className="guide">
            <summary>
              <BookOpen size={15} />
              创作指南
            </summary>
            <p>
              从故事梗概开始，确定角色与场景，再逐个完善分镜。每次保存都会保留一个新版本，随时可以回看和恢复。
            </p>
          </details>
          <div className="sidebar-profile">
            <span>导</span>
            <div>
              {session.data.username}
              <small>你的导演工作室</small>
            </div>
            <i />
          </div>
        </aside>
        <main className="project-library">
          <div className="page-title">
            <div>
              <span className="eyebrow">STORIES WAITING TO BE TOLD</span>
              <h1>
                {archived ? "已归档项目" : "我的故事"}
                <span>.</span>
              </h1>
              <p>所有值得被看见的故事，都从这里开始。</p>
            </div>
            <button className="btn primary" onClick={() => setCreating(true)}>
              <Plus size={16} />
              新建故事
            </button>
          </div>
          <section className="welcome-banner">
            <div>
              <span className="banner-kicker">
                <Clapperboard size={15} /> YOUR NEXT SCENE STARTS HERE
              </span>
              <h2>
                一个念头，
                <br />
                <em>一整个故事。</em>
              </h2>
              <p>
                写下故事，认识角色，安排每一个镜头。
                <br />
                把灵感，慢慢变成你的作品。
              </p>
              <button onClick={() => setCreating(true)}>
                开启新的故事 <ArrowUpRight size={16} />
              </button>
            </div>
            <div className="banner-art" aria-hidden="true">
              <div className="script-sheet">
                <small>映言 / 剧本手记</small>
                <span className="script-scene">INT. 咖啡馆 · 雨夜</span>
                <i />
                <i />
                <i />
                <strong>林夏</strong>
                <p>你真的要走？</p>
                <strong>陈默</strong>
                <p>我会回来。</p>
                <span className="sheet-number">SCENE 01 — A NEW BEGINNING</span>
              </div>
              <div className="banner-film">
                <Film size={43} />
                <span>
                  TAKE
                  <br />
                  <b>01</b>
                </span>
              </div>
              <span className="art-cross">✳</span>
            </div>
          </section>
          <div className="library-stats">
            <span>
              <FolderOpen size={15} />
              <b>{query.data?.length || 0}</b>个{archived ? "归档" : "创作"}项目
            </span>
            <span>
              <Users size={15} />
              <b>
                {(query.data || []).reduce(
                  (n, p) => n + p.document.characters.length,
                  0,
                )}
              </b>
              位故事角色
            </span>
            <span>
              <Film size={15} />
              <b>
                {(query.data || []).reduce(
                  (n, p) => n + p.document.shots.length,
                  0,
                )}
              </b>
              个分镜
            </span>
          </div>
          <div className="collection-header">
            <h2>
              {archived ? "归档收藏" : "故事收藏"}
              <small>THE STORY COLLECTION</small>
            </h2>
            <div className="search-box">
              <Search size={15} />
              <input
                aria-label="搜索故事"
                placeholder="寻找一个故事…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button aria-label="清空搜索" onClick={() => setSearch("")}>
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
          <div className="collection-subhead">
            <span>
              {search
                ? `找到 ${projects.length} 个项目`
                : "每一份灵感，都有自己的位置。"}
            </span>
            <span>
              <ArrowDownWideNarrow size={12} />
              最近编辑
            </span>
          </div>
          {query.isPending ? (
            <Loading />
          ) : query.error ? (
            <ErrorMessage message={query.error.message} />
          ) : projects.length === 0 ? (
            <div className="library-empty">
              <span className="empty-icon">
                <Clapperboard size={28} />
              </span>
              <h3>
                {search
                  ? "没有找到这个故事"
                  : archived
                    ? "这里暂时没有归档故事"
                    : "你的第一个故事，还在等你"}
              </h3>
              <p>一个人物、一句话，或一个挥之不去的画面，都可以是开始。</p>
              <button
                className="btn secondary"
                onClick={() => setCreating(true)}
              >
                <Plus size={15} />
                创建我的第一个故事
              </button>
            </div>
          ) : (
            <div className="project-grid">
              {projects.map((p, i) => (
                <Link
                  href={`/studio/${p.id}`}
                  className="project-card"
                  key={p.id}
                >
                  <div className={`project-cover palette-${i % 4}`}>
                    <span className="cover-genre">{p.genre}</span>
                    <span className="cover-frame" />
                    <span className="cover-initial">{p.title.slice(0, 2)}</span>
                    <span className="cover-caption">A STORY BY YOU</span>
                    <span className="cover-open">
                      <ArrowUpRight size={19} />
                    </span>
                    <span className="cover-duration">
                      {p.targetDuration}s · 9:16
                    </span>
                  </div>
                  <div className="project-card-info">
                    <h3>{p.title}</h3>
                    <span>V{p.revision}</span>
                  </div>
                  <p>{p.logline || "一个新的故事，等待你来续写。"}</p>
                  <div className="project-card-meta">
                    <span>
                      {p.document.characters.length} 角色 ·{" "}
                      {p.document.shots.length} 分镜
                    </span>
                    <time>{date(p.updatedAt)}</time>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <Footer />
        </main>
      </div>
      {creating && (
        <CreateProject
          onClose={() => setCreating(false)}
          onCreated={(p) => router.push(`/studio/${p.id}?compose=1`)}
        />
      )}
    </>
  );
}

function CreateProject({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (p: Project) => void;
}) {
  const [title, setTitle] = useState("");
  const [logline, setLogline] = useState("");
  const [genre, setGenre] = useState("都市剧情");
  const [duration, setDuration] = useState(45);
  const create = useMutation({
    mutationFn: () =>
      send<Project>("/projects", {
        title,
        logline,
        genre,
        targetDuration: duration,
      }),
    onSuccess: onCreated,
  });
  return (
    <Modal title="新建故事" onClose={onClose}>
      <p className="modal-intro">先给这个故事一个名字。其余的，我们慢慢写。</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <label>
          故事名称
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={120}
            placeholder="例如：雨夜的咖啡馆"
          />
        </label>
        <label>
          一句话简介
          <textarea
            value={logline}
            onChange={(e) => setLogline(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="谁，在什么地方，遇见了怎样的故事？"
          />
        </label>
        <div className="form-row">
          <label>
            故事类型
            <select value={genre} onChange={(e) => setGenre(e.target.value)}>
              {[
                "都市剧情",
                "温暖治愈",
                "悬疑故事",
                "爱情短片",
                "生活片段",
                "其他",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            目标时长
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              <option value={30}>30 秒</option>
              <option value={45}>45 秒</option>
              <option value={60}>60 秒</option>
            </select>
          </label>
        </div>
        {create.error && <ErrorMessage message={create.error.message} />}
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={onClose}>
            取消
          </button>
          <button
            className="btn primary"
            disabled={!title.trim() || create.isPending}
          >
            创建项目
            <ArrowUpRight size={15} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
