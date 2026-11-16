"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Brain,
  Check,
  LoaderCircle,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { api, send } from "@/lib/api";
import type { Conversation, WritingMemory } from "@/lib/types";
import { ErrorMessage, Modal } from "./ui";

const emptyMemory: WritingMemory = {
  requirements: [],
  summary: "",
  suggestions: [],
  revokedRequirements: [],
  updatedAt: null,
};
export function WritingMemoryEditor({
  conversation,
  onClose,
  onUpdated,
}: {
  conversation: Conversation;
  onClose: () => void;
  onUpdated: (state: Conversation) => void;
}) {
  const client = useQueryClient();
  const [baseline, setBaseline] = useState(conversation);
  const [draft, setDraft] = useState<WritingMemory>(() =>
    structuredClone(conversation.memory || emptyMemory),
  );
  const [addition, setAddition] = useState("");
  const [localError, setLocalError] = useState("");
  const [reloading, setReloading] = useState(false);
  const original = baseline.memory || emptyMemory;
  const dirty =
    JSON.stringify({
      requirements: draft.requirements,
      summary: draft.summary,
      suggestions: draft.suggestions,
    }) !==
    JSON.stringify({
      requirements: original.requirements,
      summary: original.summary,
      suggestions: original.suggestions,
    });
  const save = useMutation({
    mutationFn: () =>
      send<Conversation>(
        `/projects/${baseline.projectId}/conversation/memory`,
        {
          expectedVersion: baseline.version,
          expectedRevision: baseline.currentRevision,
          requirements: draft.requirements,
          summary: draft.summary,
          suggestions: draft.suggestions,
        },
        "PUT",
      ),
    onSuccess: onUpdated,
  });
  function close() {
    if (
      (dirty || addition.trim()) &&
      !window.confirm("记忆还有未保存的更改，确定关闭？")
    )
      return;
    onClose();
  }
  function add(text: string) {
    const value = text.trim();
    if (!value) return;
    if (draft.requirements.length >= 20) {
      setLocalError("最多保留 20 条长期要求，请先合并或删除。 ");
      return;
    }
    if (draft.requirements.includes(value)) {
      setLocalError("这条要求已经在长期记忆中。");
      return;
    }
    setDraft((current) => ({
      ...current,
      requirements: [...current.requirements, value],
      suggestions: current.suggestions.filter((s) => s !== value),
    }));
    setAddition((current) => (current.trim() === value ? "" : current));
    setLocalError("");
  }
  async function reload() {
    if (
      (dirty || addition.trim()) &&
      !window.confirm("重新读取会替换面板中未保存的编辑。是否继续？")
    )
      return;
    setReloading(true);
    setLocalError("");
    try {
      const state = await api<Conversation>(
        `/projects/${baseline.projectId}/conversation`,
      );
      client.setQueryData(["conversation", baseline.projectId], state);
      setBaseline(state);
      setDraft(structuredClone(state.memory || emptyMemory));
      setAddition("");
      save.reset();
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "无法读取最新记忆");
    } finally {
      setReloading(false);
    }
  }
  return (
    <Modal title="创作记忆" onClose={close} className="writing-memory-modal">
      <div className="memory-intro">
        <Brain size={22} />
        <p>
          已确认的要求会随每轮对话传给模型。AI 只提出建议，重要设定由你决定。
        </p>
      </div>
      <section className="memory-section">
        <div className="memory-section-heading">
          <h3>长期创作要求</h3>
          <span>{draft.requirements.length} / 20</span>
        </div>
        <p className="memory-help">
          例如：始终保留两位主角、对白克制、结局保持留白。
        </p>
        {!draft.requirements.length && (
          <p className="memory-empty">
            还没有已确认的要求。可以手动添加，或采纳下方的 AI 建议。
          </p>
        )}
        <div className="memory-requirements">
          {draft.requirements.map((value, index) => (
            <div className="memory-requirement" key={index}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <textarea
                aria-label={`长期要求 ${index + 1}`}
                rows={2}
                maxLength={300}
                value={value}
                onChange={(e) =>
                  setDraft((current) => ({
                    ...current,
                    requirements: current.requirements.map((v, i) =>
                      i === index ? e.target.value : v,
                    ),
                  }))
                }
              />
              <button
                className="icon-btn danger"
                aria-label={`删除长期要求 ${index + 1}`}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    requirements: current.requirements.filter(
                      (_, i) => i !== index,
                    ),
                  }))
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <label>
          新增长期要求
          <textarea
            rows={2}
            maxLength={300}
            value={addition}
            onChange={(e) => setAddition(e.target.value)}
            placeholder="写下你希望每一轮都被记住的设定或限制…"
          />
        </label>
        <button
          className="btn secondary small"
          disabled={!addition.trim() || draft.requirements.length >= 20}
          onClick={() => add(addition)}
        >
          <Plus size={15} />
          添加要求
        </button>
      </section>
      <section className="memory-section">
        <div className="memory-section-heading">
          <h3>故事摘要</h3>
          <span>AI 辅助整理 · 可修正</span>
        </div>
        <p className="memory-help">
          摘要会在后续结构化回复中滚动更新。重要约束请放入长期要求，避免只停留在摘要中。
        </p>
        <label className="sr-only" htmlFor="writing-summary">
          故事摘要
        </label>
        <textarea
          id="writing-summary"
          rows={5}
          maxLength={4000}
          value={draft.summary}
          onChange={(e) =>
            setDraft((current) => ({ ...current, summary: e.target.value }))
          }
          placeholder="摘要将在后续对话中逐步建立。已有旧设定也可以在这里手动补充。"
        />
      </section>
      <section className="memory-section">
        <div className="memory-section-heading">
          <h3>AI 建议 · 待确认</h3>
          <span>{draft.suggestions.length} 条</span>
        </div>
        <p className="memory-help">
          采纳后还需点击「保存创作记忆」，才会成为长期要求。
        </p>
        {!draft.suggestions.length ? (
          <p className="memory-empty">目前没有待确认建议。</p>
        ) : (
          draft.suggestions.map((text, index) => (
            <article className="memory-suggestion" key={`${index}-${text}`}>
              <p>{text}</p>
              <div>
                <button
                  className="btn secondary small"
                  aria-label={`采纳建议：${text}`}
                  disabled={draft.requirements.length >= 20}
                  onClick={() => add(text)}
                >
                  <Check size={14} />
                  采纳
                </button>
                <button
                  className="text-button"
                  aria-label={`忽略建议：${text}`}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      suggestions: current.suggestions.filter(
                        (_, i) => i !== index,
                      ),
                    }))
                  }
                >
                  忽略
                </button>
              </div>
            </article>
          ))
        )}
      </section>
      {draft.revokedRequirements.length > 0 && (
        <details className="memory-revoked">
          <summary>
            已撤销的要求 · {draft.revokedRequirements.length} 条
          </summary>
          <p className="memory-help">
            已移除的要求不再作为长期约束，历史聊天仍保留。重新添加并保存可以恢复。
          </p>
          {draft.revokedRequirements.map((text, index) => (
            <p key={`${index}-${text}`}>{text}</p>
          ))}
        </details>
      )}
      {(localError || save.error) && (
        <ErrorMessage
          message={localError || save.error?.message || "保存失败"}
        />
      )}
      <div className="memory-actions">
        <button
          className="btn secondary"
          disabled={save.isPending || reloading}
          onClick={() => void reload()}
        >
          <RefreshCw size={15} />
          读取最新记忆
        </button>
        <button
          className="btn primary"
          disabled={
            !dirty ||
            save.isPending ||
            reloading ||
            draft.requirements.some((v) => !v.trim())
          }
          onClick={() => {
            if (addition.trim()) {
              setLocalError("请先点击「添加要求」，再保存创作记忆。");
              return;
            }
            setLocalError("");
            save.mutate();
          }}
        >
          {save.isPending ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Check size={16} />
          )}
          保存创作记忆
        </button>
      </div>
    </Modal>
  );
}
