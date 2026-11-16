"use client";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  FileText,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import { api, ApiError, send } from "@/lib/api";
import type {
  Conversation,
  ConversationSaved,
  Project,
  SystemInfo,
} from "@/lib/types";
import { ErrorMessage, Loading, Modal } from "./ui";

export function AiAssistant({
  project,
  onClose,
  onSaved,
}: {
  project: Project;
  onClose: () => void;
  onSaved: (p: Project) => void;
}) {
  const system = useQuery({
    queryKey: ["system"],
    queryFn: ({ signal }) => api<SystemInfo>("/system", { signal }),
  });
  const conversation = useQuery({
    queryKey: ["conversation", project.id],
    queryFn: ({ signal }) =>
      api<Conversation>(`/projects/${project.id}/conversation`, { signal }),
    enabled: !!system.data?.aiConfigured,
    refetchOnMount: "always",
    refetchInterval: (query) => (query.state.data?.processing ? 2000 : false),
  });
  return (
    <Modal
      title={`对话创作 · ${project.title}`}
      onClose={onClose}
      wide
      className="conversation-modal"
    >
      {system.isPending ? (
        <Loading />
      ) : system.error ? (
        <ErrorMessage message={system.error.message} />
      ) : !system.data?.aiConfigured ? (
        <div className="conversation-unavailable">
          <Sparkles size={28} />
          <h3>文本辅助尚未连接</h3>
          <p>
            配置文本模型后，就能在这里边聊边写。现在仍然可以在工作台手动创作剧本。
          </p>
          <small>所有模型密钥都由服务器管理。</small>
        </div>
      ) : conversation.isPending ? (
        <Loading />
      ) : conversation.data ? (
        <ConversationEditor
          project={project}
          conversation={conversation.data}
          onSaved={onSaved}
          onRefresh={() => void conversation.refetch()}
        />
      ) : (
        <div className="conversation-unavailable">
          <ErrorMessage
            message={conversation.error?.message || "无法读取创作对话"}
          />
          <button
            className="btn secondary"
            onClick={() => void conversation.refetch()}
          >
            重新读取对话
          </button>
        </div>
      )}
    </Modal>
  );
}

function ConversationEditor({
  project,
  conversation,
  onSaved,
  onRefresh,
}: {
  project: Project;
  conversation: Conversation;
  onSaved: (p: Project) => void;
  onRefresh: () => void;
}) {
  const client = useQueryClient();
  const [input, setInput] = useState(conversation.pendingPrompt);
  const [notice, setNotice] = useState("");
  const [view, setView] = useState("chat");
  const log = useRef<HTMLDivElement>(null);
  function update(state: Conversation) {
    client.setQueryData(["conversation", project.id], state);
  }
  const turn = useMutation({
    mutationFn: (message: string) =>
      send<Conversation>(`/projects/${project.id}/conversation/turns`, {
        expectedVersion: conversation.version,
        expectedRevision: conversation.baseRevision,
        message,
      }),
    onSuccess: (state, message) => {
      update(state);
      setInput((current) => (current === message ? "" : current));
      setNotice("");
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) onRefresh();
    },
  });
  const save = useMutation({
    mutationFn: () =>
      send<ConversationSaved>(`/projects/${project.id}/conversation/save`, {
        expectedVersion: conversation.version,
        expectedRevision: conversation.baseRevision,
      }),
    onSuccess: (result) => {
      update(result.conversation);
      onSaved(result.project);
      setNotice(`已保存为 V${result.project.revision}，可以继续对话完善。`);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) onRefresh();
    },
  });
  const rebase = useMutation({
    mutationFn: () =>
      send<ConversationSaved>(`/projects/${project.id}/conversation/rebase`, {
        expectedVersion: conversation.version,
        expectedRevision: conversation.currentRevision,
      }),
    onSuccess: (result) => {
      update(result.conversation);
      onSaved(result.project);
      turn.reset();
      save.reset();
      setNotice("已从最新保存的剧本继续，对话记录仍保留。");
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) onRefresh();
    },
  });
  const busy =
    turn.isPending ||
    conversation.processing ||
    save.isPending ||
    rebase.isPending;
  const messages = conversation.messages;
  const draft = conversation.document;
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages.length, turn.isPending]);
  function submit() {
    if (!input.trim() || busy || conversation.stale) return;
    save.reset();
    turn.mutate(input);
  }
  const error = turn.error || save.error || rebase.error;
  return (
    <div className="conversation-workbench">
      <div className="conversation-toolbar">
        <div>
          <span className="conversation-status">
            <span
              className={conversation.hasChanges ? "unsaved-dot" : "saved-dot"}
            />
            {conversation.hasChanges
              ? "对话草稿 · 尚未保存为正式版本"
              : `已与 V${conversation.baseRevision} 同步`}
          </span>
          <small>对话和工作草稿会保留，满意后再保存剧本。</small>
        </div>
        <div className="conversation-toolbar-actions">
          <button
            className="icon-btn"
            aria-label="刷新对话"
            title="刷新对话"
            disabled={busy}
            onClick={onRefresh}
          >
            <RefreshCw size={16} />
          </button>
          <button
            className="btn primary"
            disabled={!conversation.hasChanges || busy || conversation.stale}
            onClick={() => {
              turn.reset();
              save.mutate();
            }}
          >
            {save.isPending ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Check size={16} />
            )}
            满意，保存剧本
          </button>
        </div>
      </div>
      {notice && (
        <p className="conversation-notice" role="status">
          {notice}
        </p>
      )}
      {conversation.stale && (
        <div className="conversation-conflict" role="alert">
          <p>
            剧本已有新保存的 V{conversation.currentRevision}
            。当前对话草稿仍保留，请先同步最新版本再继续。
          </p>
          <button
            className="btn secondary small"
            disabled={busy}
            onClick={() => {
              if (
                !conversation.hasChanges ||
                window.confirm(
                  "当前对话草稿将替换为最新保存的剧本，对话记录会保留。是否继续？",
                )
              )
                rebase.mutate();
            }}
          >
            从已保存版本继续
          </button>
        </div>
      )}
      <nav className="conversation-mobile-tabs" aria-label="对话创作视图">
        <button
          className={view === "chat" ? "active" : ""}
          aria-pressed={view === "chat"}
          onClick={() => setView("chat")}
        >
          <MessageCircle size={16} />
          对话
        </button>
        <button
          className={view === "preview" ? "active" : ""}
          aria-pressed={view === "preview"}
          onClick={() => setView("preview")}
        >
          <FileText size={16} />
          剧本预览
        </button>
      </nav>
      <div className="conversation-layout" data-view={view}>
        <section className="conversation-chat" aria-label="编剧对话区">
          <div
            className="conversation-log"
            role="log"
            aria-label="剧本创作对话"
            aria-live="polite"
            ref={log}
          >
            {!messages.length && (
              <div className="conversation-welcome">
                <span className="conversation-avatar">
                  <Sparkles size={22} />
                </span>
                <h3>从「{project.title}」开始。</h3>
                <p>
                  告诉我你想讲怎样的故事。你可以先聊人物与情绪，也可以直接给我一个场景，我们一起慢慢改。
                </p>
                <div className="conversation-starters">
                  {[
                    "先帮我构思一个故事方向。",
                    "我有一个想法，想和你一起完善。",
                  ].map((text) => (
                    <button key={text} onClick={() => setInput(text)}>
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message) => (
              <article
                key={message.id}
                className={`conversation-message ${message.role}`}
              >
                <span className="conversation-speaker">
                  {message.role === "user" ? "你" : "映言 · 编剧搭档"}
                </span>
                <p>{message.content}</p>
              </article>
            ))}
            {turn.isPending && (
              <article className="conversation-message user pending">
                <span className="conversation-speaker">你 · 发送中</span>
                <p>{turn.variables}</p>
              </article>
            )}
            {(turn.isPending || conversation.processing) && (
              <div className="conversation-thinking" role="status">
                <LoaderCircle size={17} className="spin" />
                正在结合当前剧本思考，你可以先写下下一条想法…
              </div>
            )}
          </div>
          <form
            className="conversation-composer"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            {error && <ErrorMessage message={error.message} />}
            <label htmlFor="conversation-input">和 AI 讨论剧本</label>
            <textarea
              id="conversation-input"
              rows={3}
              maxLength={5000}
              placeholder="例如：保留这两个人物，让对白更自然一些，结局不要直接说破。"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (
                  (e.ctrlKey || e.metaKey) &&
                  e.key === "Enter" &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <div className="conversation-compose-actions">
              <small>Ctrl / ⌘ + Enter 发送 · 输入框中的想法需先发送</small>
              <button
                className="btn primary"
                type="submit"
                disabled={busy || conversation.stale || !input.trim()}
              >
                {turn.isPending ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <Send size={16} />
                )}
                发送消息
              </button>
            </div>
          </form>
        </section>
        <section className="conversation-preview" aria-label="当前剧本预览">
          <header>
            <span className="eyebrow">THE SCRIPT · 当前工作草稿</span>
            <h3>{project.title}</h3>
            <p>
              {draft.characters.length} 位角色 · {draft.scenes.length} 个场景 ·{" "}
              {draft.shots.length} 个镜头
            </p>
          </header>
          <div className="conversation-preview-body">
            <h4>故事梗概</h4>
            <p data-testid="conversation-story">
              {draft.story || "故事还没落笔。先在对话里聊聊你的想法。"}
            </p>
            <h4>剧本文稿</h4>
            <pre>{draft.script || "每轮对话后，完整的剧本会更新在这里。"}</pre>
            {draft.characters.length > 0 && (
              <>
                <h4>出场角色</h4>
                {draft.characters.map((c) => (
                  <p key={c.id}>
                    <strong>{c.name}</strong> · {c.description}
                  </p>
                ))}
              </>
            )}
            {draft.shots.length > 0 && (
              <details>
                <summary>查看 {draft.shots.length} 个分镜</summary>
                {draft.shots.map((shot, i) => (
                  <article className="conversation-shot" key={shot.id}>
                    <strong>
                      {String(i + 1).padStart(2, "0")} · {shot.title}
                    </strong>
                    <p>{shot.description}</p>
                    {shot.dialogue && (
                      <p>
                        {
                          draft.characters.find(
                            (c) => c.id === shot.dialogue?.speakerId,
                          )?.name
                        }
                        ：{shot.dialogue.text}
                      </p>
                    )}
                  </article>
                ))}
              </details>
            )}
          </div>
          <footer>
            <FileText size={14} />
            这里展示当前草稿，点击「满意，保存剧本」后写入正式版本。
          </footer>
        </section>
      </div>
    </div>
  );
}
