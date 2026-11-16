"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, History, RotateCcw } from "lucide-react";
import { api, date, send } from "@/lib/api";
import type { Project, Revision } from "@/lib/types";
import { ErrorMessage, Loading, Modal } from "./ui";
export function Revisions({
  project,
  onClose,
  onRestored,
}: {
  project: Project;
  onClose: () => void;
  onRestored: (p: Project) => void;
}) {
  const [selected, setSelected] = useState<Revision | null>(null);
  const query = useQuery({
    queryKey: ["revisions", project.id, project.revision],
    queryFn: ({ signal }) =>
      api<Revision[]>(`/projects/${project.id}/revisions`, { signal }),
  });
  const restore = useMutation({
    mutationFn: (sourceRevision: number) =>
      send<Project>(`/projects/${project.id}/restore`, {
        expectedRevision: project.revision,
        sourceRevision,
      }),
    onSuccess: onRestored,
  });
  return (
    <Modal title="版本记录" onClose={onClose} wide>
      {selected ? (
        <>
          <button className="text-button" onClick={() => setSelected(null)}>
            <ArrowLeft size={14} />
            全部版本
          </button>
          <div className="revision-preview">
            <span className="revision-pill">V{selected.revision}</span>
            <h3>{selected.title}</h3>
            <p>
              {selected.summary} · {date(selected.createdAt)}
            </p>
            <div className="revision-counts">
              {selected.document.characters.length} 位角色 ·{" "}
              {selected.document.scenes.length} 个场景 ·{" "}
              {selected.document.shots.length} 个镜头
            </div>
            <pre>{selected.document.story || "这个版本的故事梗概为空。"}</pre>
            <pre>{selected.document.script}</pre>
          </div>
          {restore.error && <ErrorMessage message={restore.error.message} />}
          <div className="modal-actions">
            <button className="btn secondary" onClick={() => setSelected(null)}>
              返回
            </button>
            <button
              className="btn primary"
              disabled={
                restore.isPending || selected.revision === project.revision
              }
              onClick={() => restore.mutate(selected.revision)}
            >
              <RotateCcw size={15} />
              恢复为新版本
            </button>
          </div>
          <p className="field-note">恢复会创建新版本，已有历史会完整保留。</p>
        </>
      ) : query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorMessage message={query.error.message} />
      ) : (
        <div className="revisions-list">
          {query.data.map((r) => (
            <article key={r.revision}>
              <span className="revision-dot">
                <History size={15} />
              </span>
              <div>
                <h3>
                  V{r.revision}
                  <span>{r.summary}</span>
                  {r.revision === project.revision && <small>当前版本</small>}
                </h3>
                <p>
                  {date(r.createdAt)} · {r.document.characters.length} 角色 ·{" "}
                  {r.document.shots.length} 镜头
                </p>
              </div>
              <button
                className="btn secondary small"
                aria-label={`查看 V${r.revision}`}
                onClick={() => setSelected(r)}
              >
                查看
              </button>
            </article>
          ))}
        </div>
      )}
    </Modal>
  );
}
