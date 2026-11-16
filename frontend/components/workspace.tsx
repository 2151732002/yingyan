"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clapperboard,
  Download,
  FileText,
  History,
  Layers3,
  LoaderCircle,
  Save,
  Settings2,
  Sparkles,
  Users,
} from "lucide-react";
import { useSession } from "./session";
import { Topbar, Footer } from "./topbar";
import { ErrorMessage, Loading, Modal } from "./ui";
import { StoryPanel } from "./story-panel";
import { CharactersPanel } from "./characters-panel";
import { ShotsPanel } from "./shots-panel";
import { Revisions } from "./revisions";
import { AiAssistant } from "./ai-assistant";
import { api, ApiError, send } from "@/lib/api";
import { sampleDocument } from "@/lib/sample";
import type { Asset, Project, StoryDocument } from "@/lib/types";

export function Workspace({
  id,
  openAssistant = false,
}: {
  id: string;
  openAssistant?: boolean;
}) {
  const session = useSession();
  const query = useQuery({
    queryKey: ["project", id],
    queryFn: ({ signal }) => api<Project>(`/projects/${id}`, { signal }),
    enabled: !!session.data,
  });
  if (session.isPending || query.isPending) return <Loading />;
  if (!query.data)
    return (
      <div className="standalone-error">
        <ErrorMessage message={query.error?.message || "无法打开项目"} />
        <Link className="btn secondary" href="/projects">
          返回我的故事
        </Link>
      </div>
    );
  return (
    <ProjectEditor
      key={id}
      initial={query.data}
      openAssistant={openAssistant}
    />
  );
}
function content(p: Project) {
  return JSON.stringify({
    title: p.title,
    logline: p.logline,
    genre: p.genre,
    targetDuration: p.targetDuration,
    document: p.document,
  });
}
function ProjectEditor({
  initial,
  openAssistant,
}: {
  initial: Project;
  openAssistant: boolean;
}) {
  const client = useQueryClient();
  const [draft, setDraft] = useState<Project>(() => structuredClone(initial));
  const [saved, setSaved] = useState(initial);
  const [tab, setTab] = useState("story");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [history, setHistory] = useState(false);
  const [settings, setSettings] = useState(false);
  const [assistant, setAssistant] = useState(openAssistant);
  const [conflict, setConflict] = useState(false);
  const dirty = content(draft) !== content(saved);
  const assets = useQuery({
    queryKey: ["assets", initial.id],
    queryFn: ({ signal }) =>
      api<Asset[]>(`/projects/${initial.id}/assets`, { signal }),
  });
  const save = useMutation({
    mutationFn: (submitted: Project) =>
      send<Project>(
        `/projects/${submitted.id}`,
        {
          expectedRevision: saved.revision,
          title: submitted.title,
          logline: submitted.logline,
          genre: submitted.genre,
          targetDuration: submitted.targetDuration,
          document: submitted.document,
          summary:
            "更新" +
            ({
              story: "剧本与场景",
              characters: "角色设定",
              shots: "分镜与对白",
              check: "创作内容",
            }[tab] || "草稿"),
        },
        "PUT",
      ),
    onSuccess: (p, submitted) => {
      setSaved(p);
      setDraft((current) =>
        content(current) === content(submitted)
          ? p
          : { ...current, revision: p.revision },
      );
      setNotice("已保存新版本 V" + p.revision);
      setConflict(false);
      void client.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e) => {
      setError(e.message);
      if (e instanceof ApiError && e.status === 409) setConflict(true);
    },
  });
  const archive = useMutation({
    mutationFn: () =>
      send<Project>(
        `/projects/${draft.id}/${draft.archived ? "unarchive" : "archive"}`,
        { expectedRevision: saved.revision },
      ),
    onSuccess: (p) => {
      setSaved(p);
      setDraft(p);
      setSettings(false);
      setNotice(p.archived ? "项目已归档" : "项目已重新启用");
      void client.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e) => setError(e.message),
  });
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  function change(document: StoryDocument) {
    setDraft((current) => ({ ...current, document }));
    setNotice("");
  }
  function onAsset(asset: Asset, characterId: string) {
    client.setQueryData<Asset[]>(["assets", initial.id], (old) => [
      asset,
      ...(old || []),
    ]);
    setDraft((current) => ({
      ...current,
      document: {
        ...current.document,
        characters: current.document.characters.map((c) =>
          c.id === characterId ? { ...c, referenceAssetId: asset.id } : c,
        ),
      },
    }));
  }
  function download() {
    const blob = new Blob([JSON.stringify(draft, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${draft.title}-V${saved.revision}-草稿.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function reload() {
    try {
      const p = await api<Project>(`/projects/${draft.id}`);
      setDraft(p);
      setSaved(p);
      setConflict(false);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "读取失败");
    }
  }
  const complete = [
    {
      label: "故事梗概",
      done: !!draft.document.story.trim(),
      note: "让故事有一个清晰的起点",
      tab: "story",
    },
    {
      label: "角色设定",
      done: draft.document.characters.length > 0,
      note: `已创建 ${draft.document.characters.length} 位角色`,
      tab: "characters",
    },
    {
      label: "场景与站位",
      done: draft.document.scenes.length > 0,
      note: `已记录 ${draft.document.scenes.length} 个场景`,
      tab: "story",
    },
    {
      label: "镜头与对白",
      done: draft.document.shots.length > 0,
      note: `已编排 ${draft.document.shots.length} 个镜头`,
      tab: "shots",
    },
  ];
  return (
    <div className="studio-app">
      <Topbar name={draft.title}>
        <button
          className="topbar-text-btn"
          onClick={() => {
            if (
              !dirty ||
              window.confirm(
                "当前有未保存的更改，恢复历史版本会替换这些内容。是否继续查看？",
              )
            )
              setHistory(true);
          }}
        >
          <History size={15} />
          版本记录
        </button>
      </Topbar>
      <header className="studio-header">
        <div className="studio-title">
          <Link
            href="/projects"
            className="icon-btn"
            aria-label="返回我的故事"
            onClick={(e) => {
              if (dirty && !window.confirm("有尚未保存的更改，确定离开？"))
                e.preventDefault();
            }}
          >
            <ArrowLeft size={17} />
          </Link>
          <div>
            <h1>
              {draft.title}
              <span>V{saved.revision}</span>
              {draft.archived && <small>已归档</small>}
            </h1>
            <p>
              {draft.genre} · {draft.targetDuration} 秒 · 9:16 · 写实剧情
            </p>
          </div>
          <button
            className="icon-btn"
            aria-label="项目设置"
            onClick={() => setSettings(true)}
          >
            <Settings2 size={16} />
          </button>
        </div>
        <div className="studio-save">
          <span className={dirty ? "save-status dirty" : "save-status"}>
            {save.isPending ? (
              <LoaderCircle size={13} className="spin" />
            ) : (
              <CheckCircle2 size={13} />
            )}
            <span>{dirty ? "有尚未保存的更改" : "全部更改已保存"}</span>
          </span>
          <button
            className="btn secondary"
            disabled={dirty || draft.archived}
            onClick={() => setAssistant(true)}
            title={dirty ? "先保存当前故事，再生成建议" : ""}
          >
            <Sparkles size={15} />
            AI 编剧
          </button>
          <button
            className="btn primary"
            disabled={!dirty || save.isPending || draft.archived}
            onClick={() => {
              setError("");
              save.mutate(structuredClone(draft));
            }}
          >
            <Save size={15} />
            保存版本
          </button>
        </div>
      </header>
      <nav className="studio-tabs" aria-label="创作工作区">
        {[
          { id: "story", name: "剧本", en: "STORY", icon: FileText },
          { id: "characters", name: "角色", en: "CHARACTERS", icon: Users },
          { id: "shots", name: "分镜", en: "STORYBOARD", icon: Clapperboard },
          { id: "check", name: "创作检查", en: "REVIEW", icon: CheckCircle2 },
        ].map(({ id, name, en, icon: Icon }, i) => (
          <button
            key={id}
            aria-label={name}
            aria-pressed={tab === id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            <span className="tab-index">0{i + 1}</span>
            <Icon size={16} />
            {name}
            <small>{en}</small>
            {id === "characters" && <b>{draft.document.characters.length}</b>}
            {id === "shots" && <b>{draft.document.shots.length}</b>}
          </button>
        ))}
      </nav>
      <main className="studio-main">
        {error && <ErrorMessage message={error} />}{" "}
        {notice && (
          <div className="success-message" role="status">
            <Check size={15} />
            {notice}
          </div>
        )}
        {conflict && (
          <div className="conflict-actions">
            <p>你的草稿仍保留在当前页面。可以先下载备份，再载入最新版本。</p>
            <button className="btn secondary small" onClick={download}>
              <Download size={14} />
              下载当前草稿
            </button>
            <button
              className="btn secondary small"
              onClick={() => void reload()}
            >
              载入最新版本
            </button>
          </div>
        )}
        {draft.archived ? (
          <div className="panel-empty">
            <Archive size={33} />
            <h2>这个故事，暂时收藏起来了</h2>
            <p>历史版本与素材仍然保留，重新启用后可继续编辑。</p>
            <button
              className="btn primary"
              onClick={() => archive.mutate()}
              disabled={archive.isPending}
            >
              重新启用项目
            </button>
          </div>
        ) : (
          <>
            {tab === "story" && (
              <StoryPanel
                document={draft.document}
                onChange={change}
                onError={setError}
                onSample={() => {
                  if (
                    (draft.document.story || draft.document.shots.length) &&
                    !window.confirm(
                      "示例会替换当前草稿中的故事、角色与分镜。是否继续？",
                    )
                  )
                    return;
                  change(sampleDocument());
                  setNotice("已载入本地示例，可自由修改后保存。");
                }}
              />
            )}
            {tab === "characters" && (
              <CharactersPanel
                projectId={draft.id}
                document={draft.document}
                assets={assets.data || []}
                onChange={change}
                onAsset={onAsset}
                onError={setError}
              />
            )}
            {tab === "shots" && (
              <ShotsPanel
                document={draft.document}
                assets={assets.data || []}
                onChange={change}
                onError={setError}
              />
            )}
            {tab === "check" && (
              <section className="review-panel">
                <div className="editor-page-heading">
                  <div>
                    <span className="eyebrow">
                      04 / READY FOR THE NEXT SCENE
                    </span>
                    <h1>让每个细节，都准备好。</h1>
                    <p>先打磨故事与分镜，再让人物开口说话。</p>
                  </div>
                  <button className="btn secondary" onClick={download}>
                    <Download size={15} />
                    导出创作草稿
                  </button>
                </div>
                <div className="review-grid">
                  <div className="review-checks">
                    {complete.map((item) => (
                      <button key={item.label} onClick={() => setTab(item.tab)}>
                        <span
                          className={item.done ? "check-done" : "check-pending"}
                        >
                          {item.done ? <Check size={16} /> : <span />}
                        </span>
                        <div>
                          <strong>{item.label}</strong>
                          <p>{item.note}</p>
                        </div>
                        <small>{item.done ? "已准备" : "去完善"}</small>
                      </button>
                    ))}
                  </div>
                  <div className="next-stage-note">
                    <Layers3 size={29} />
                    <h2>下一幕，让故事成为影像。</h2>
                    <p>
                      第一阶段已提供结构化创作与版本保存。真实配音、人物口型和视频合成将在后续阶段接入。
                    </p>
                    <div>
                      <span>
                        已准备 {complete.filter((c) => c.done).length} /{" "}
                        {complete.length} 项
                      </span>
                      <span>当前 V{saved.revision}</span>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
        <Footer />
      </main>
      {history && (
        <Revisions
          project={saved}
          onClose={() => setHistory(false)}
          onRestored={(p) => {
            setDraft(p);
            setSaved(p);
            setHistory(false);
            setTab("story");
            setNotice("已恢复为新版本 V" + p.revision);
            setError("");
          }}
        />
      )}
      {assistant && (
        <AiAssistant
          project={saved}
          onClose={() => setAssistant(false)}
          onSaved={(project) => {
            setDraft(project);
            setSaved(project);
            client.setQueryData(["project", project.id], project);
            void client.invalidateQueries({ queryKey: ["projects"] });
            setTab("story");
            setError("");
            setNotice("对话剧本已保存到 V" + project.revision);
          }}
        />
      )}
      {settings && (
        <Modal title="项目设置" onClose={() => setSettings(false)}>
          <label>
            故事名称
            <input
              value={draft.title}
              maxLength={120}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>
          <label>
            一句话简介
            <textarea
              value={draft.logline}
              maxLength={1000}
              rows={3}
              onChange={(e) => setDraft({ ...draft, logline: e.target.value })}
            />
          </label>
          <div className="form-row">
            <label>
              故事类型
              <input
                value={draft.genre}
                maxLength={40}
                onChange={(e) => setDraft({ ...draft, genre: e.target.value })}
              />
            </label>
            <label>
              目标时长（秒）
              <input
                type="number"
                min={10}
                max={60}
                value={draft.targetDuration}
                onChange={(e) =>
                  setDraft({ ...draft, targetDuration: Number(e.target.value) })
                }
              />
            </label>
          </div>
          <div className="modal-actions">
            <button
              className="btn secondary"
              disabled={dirty || archive.isPending}
              onClick={() => archive.mutate()}
            >
              <Archive size={14} />
              {draft.archived ? "重新启用" : "归档项目"}
            </button>
            <button className="btn primary" onClick={() => setSettings(false)}>
              完成编辑
            </button>
          </div>
          <p className="field-note">完成编辑后点击“保存版本”持久化更改。</p>
        </Modal>
      )}
    </div>
  );
}
