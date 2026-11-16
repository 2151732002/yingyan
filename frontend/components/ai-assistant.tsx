"use client";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, LoaderCircle, Sparkles } from "lucide-react";
import { api, send } from "@/lib/api";
import type { Project, StoryDocument, SystemInfo } from "@/lib/types";
import { ErrorMessage, Modal } from "./ui";
export function AiAssistant({
  project,
  onClose,
  onAdopt,
}: {
  project: Project;
  onClose: () => void;
  onAdopt: (document: StoryDocument) => void;
}) {
  const [prompt, setPrompt] = useState(
    "根据当前故事，整理两位角色、一个场景和四个镜头的中文写实短片剧本，保留人物对白和情绪。",
  );
  const system = useQuery({
    queryKey: ["system"],
    queryFn: ({ signal }) => api<SystemInfo>("/system", { signal }),
  });
  const suggest = useMutation({
    mutationFn: () =>
      send<{ baseRevision: number; document: StoryDocument; model: string }>(
        `/projects/${project.id}/draft-suggestions`,
        { prompt, expectedRevision: project.revision },
      ),
  });
  return (
    <Modal title="AI 编剧助手" onClose={onClose} wide>
      <div className="assistant-intro">
        <Sparkles size={23} />
        <p>
          让灵感多走一步。生成结果会先展示为建议，采用后仍需保存为项目版本。
        </p>
      </div>
      {!system.data?.aiConfigured ? (
        <div className="connection-note">
          <h3>文本辅助尚未连接</h3>
          <p>
            你可以继续手动编写故事、人物与分镜。管理员配置文本模型后，即可在这里生成结构化建议。
          </p>
          <small>所有模型密钥都由服务器管理。</small>
        </div>
      ) : (
        <>
          {!suggest.data ? (
            <>
              <label>
                你希望怎样完善这个故事？
                <textarea
                  rows={4}
                  maxLength={5000}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </label>
              {suggest.error && (
                <ErrorMessage message={suggest.error.message} />
              )}
              <div className="modal-actions">
                <button className="btn secondary" onClick={onClose}>
                  稍后再说
                </button>
                <button
                  className="btn primary"
                  disabled={suggest.isPending || !prompt.trim()}
                  onClick={() => suggest.mutate()}
                >
                  {suggest.isPending ? (
                    <LoaderCircle size={15} className="spin" />
                  ) : (
                    <Sparkles size={15} />
                  )}
                  生成剧本建议
                  <ArrowRight size={15} />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="assistant-result">
                <div className="revision-counts">
                  {suggest.data.document.characters.length} 位角色 ·{" "}
                  {suggest.data.document.scenes.length} 个场景 ·{" "}
                  {suggest.data.document.shots.length} 个镜头
                </div>
                <h3>故事梗概</h3>
                <p>{suggest.data.document.story}</p>
                <h3>剧本文稿</h3>
                <pre>{suggest.data.document.script}</pre>
                <h3>出场角色</h3>
                {suggest.data.document.characters.map((c) => (
                  <p key={c.id}>
                    <strong>{c.name}</strong> — {c.description}
                  </p>
                ))}
              </div>
              <div className="modal-actions">
                <button
                  className="btn secondary"
                  onClick={() => suggest.reset()}
                >
                  调整要求
                </button>
                <button
                  className="btn primary"
                  onClick={() => onAdopt(suggest.data.document)}
                >
                  <Check size={15} />
                  采用建议到草稿
                </button>
              </div>
            </>
          )}
        </>
      )}
      {system.error && <ErrorMessage message={system.error.message} />}
    </Modal>
  );
}
