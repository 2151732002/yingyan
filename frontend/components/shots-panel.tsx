"use client";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Clapperboard,
  Clock3,
  ImageIcon,
  MessageSquare,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
import { moveItem } from "@/lib/editor";
import type { Shot, StoryDocument } from "@/lib/types";

const framings = {
  CLOSEUP: "近景 / 特写",
  MEDIUM: "中景",
  WIDE: "远景 / 全景",
  OVER_SHOULDER: "过肩镜头",
};
const kinds = {
  DIALOGUE: "对白镜头",
  REACTION: "反应镜头",
  ESTABLISHING: "场景镜头",
};
export function ShotsPanel({
  document,
  assets,
  onChange,
  onError,
}: {
  document: StoryDocument;
  assets: { id: string; url: string }[];
  onChange: (d: StoryDocument) => void;
  onError: (s: string) => void;
}) {
  const [selected, setSelected] = useState(document.shots[0]?.id || "");
  const active =
    document.shots.find((s) => s.id === selected) || document.shots[0];
  const index = active ? document.shots.indexOf(active) : 0;
  function update(patch: Partial<Shot>) {
    if (active)
      onChange({
        ...document,
        shots: document.shots.map((s) =>
          s.id === active.id ? { ...s, ...patch } : s,
        ),
      });
  }
  function add() {
    if (!document.scenes.length) {
      onError("请先在剧本页添加一个场景。");
      return;
    }
    const char = document.characters[0];
    const id = crypto.randomUUID();
    const shot: Shot = {
      id,
      sceneId: document.scenes[0].id,
      title: `镜头 ${document.shots.length + 1}`,
      kind: char ? "DIALOGUE" : "ESTABLISHING",
      framing: "MEDIUM",
      description: "",
      visibleCharacterIds: char ? [char.id] : [],
      durationSeconds: 5,
      dialogue: char
        ? {
            id: crypto.randomUUID(),
            speakerId: char.id,
            text: "",
            emotion: "自然",
            speed: 1,
            delivery: "ON_SCREEN",
          }
        : null,
    };
    onChange({ ...document, shots: [...document.shots, shot] });
    setSelected(id);
  }
  function move(to: number) {
    onChange({ ...document, shots: moveItem(document.shots, index, to) });
  }
  const speaker = active?.dialogue
    ? document.characters.find((c) => c.id === active.dialogue?.speakerId)
    : null;
  const visible = active
    ? document.characters.filter((c) =>
        active.visibleCharacterIds.includes(c.id),
      )
    : [];
  const reference =
    visible.length === 1
      ? assets.find((a) => a.id === visible[0].referenceAssetId)
      : null;
  return (
    <section className="shots-panel">
      <div className="editor-page-heading">
        <div>
          <span className="eyebrow">03 / THE STORYBOARD</span>
          <h1>每一个镜头，都有它的用意。</h1>
          <p>安排视线、对白和停顿，让人物真正开始交流。</p>
        </div>
        <button
          className="btn primary"
          onClick={add}
          disabled={document.shots.length >= 12}
        >
          <Plus size={15} />
          添加镜头
        </button>
      </div>
      {!active ? (
        <div className="panel-empty">
          <Clapperboard size={35} />
          <h2>给故事，第一个镜头</h2>
          <p>先在剧本页设置场景，再从一个人物、一句对白开始。</p>
          <button className="btn secondary" onClick={add}>
            <Plus size={15} />
            创建第一个镜头
          </button>
        </div>
      ) : (
        <div className="storyboard-grid">
          <aside className="shot-list">
            <div className="shot-list-heading">
              <span>镜头列表</span>
              <small>{document.shots.length} SHOTS</small>
            </div>
            {document.shots.map((s, i) => (
              <button
                key={s.id}
                className={`shot-list-item ${active.id === s.id ? "selected" : ""}`}
                onClick={() => setSelected(s.id)}
              >
                <span className={`shot-thumb kind-${s.kind.toLowerCase()}`}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <Clapperboard size={18} />
                </span>
                <span className="shot-list-text">
                  <strong>{s.title}</strong>
                  <small>
                    {kinds[s.kind]} · {s.durationSeconds}s
                  </small>
                  <span>
                    {s.dialogue?.text || s.description || "等待写下这一幕"}
                  </span>
                </span>
              </button>
            ))}
            <div className="shot-list-footer">
              <Clock3 size={13} />
              预计总时长{" "}
              {document.shots
                .reduce((n, s) => n + s.durationSeconds, 0)
                .toFixed(1)}{" "}
              秒
            </div>
          </aside>
          <div className="shot-preview-panel">
            <div className="shot-preview-top">
              <span>镜头 {String(index + 1).padStart(2, "0")}</span>
              <span>9:16 · 构图预览</span>
            </div>
            <div
              className={`shot-frame framing-${active.framing.toLowerCase()}`}
            >
              {reference ? (
                <img src={reference.url} alt="当前镜头角色参考图" />
              ) : (
                <>
                  <div className="frame-lines" />
                  <div className="shot-standins">
                    {visible.length ? (
                      visible.map((c, i) => (
                        <div className={`standin standin-${i}`} key={c.id}>
                          <UserRound size={80} strokeWidth={0.6} />
                          <span>{c.name}</span>
                        </div>
                      ))
                    ) : (
                      <ImageIcon size={48} strokeWidth={0.6} />
                    )}
                  </div>
                </>
              )}
              <div className="frame-corner top-left" />
              <div className="frame-corner bottom-right" />
              <span className="frame-scene">
                {document.scenes.find((s) => s.id === active.sceneId)?.name}
              </span>
              <div className="shot-subtitle">
                {active.dialogue?.text && (
                  <>
                    <small>
                      {speaker?.name}{" "}
                      {active.dialogue.delivery === "VOICE_OVER"
                        ? "· 画外音"
                        : ""}
                    </small>
                    <p>{active.dialogue.text}</p>
                  </>
                )}
              </div>
              <span className="frame-note">参考构图 · 视频尚未制作</span>
            </div>
            <div className="shot-preview-bottom">
              <span>
                <Clapperboard size={13} />
                {framings[active.framing]}
              </span>
              <span>{kinds[active.kind]}</span>
            </div>
            <div className="shot-direction">
              <span>导演手记</span>
              <p>
                {active.description ||
                  "在右侧写下人物动作、视线方向或镜头运动。"}
              </p>
            </div>
          </div>
          <section className="shot-settings">
            <div className="shot-settings-title">
              <h2>镜头设置</h2>
              <div>
                <button
                  className="icon-btn"
                  aria-label="镜头上移"
                  onClick={() => move(index - 1)}
                  disabled={index === 0}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  className="icon-btn"
                  aria-label="镜头下移"
                  onClick={() => move(index + 1)}
                  disabled={index === document.shots.length - 1}
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  className="icon-btn danger"
                  aria-label="删除当前镜头"
                  onClick={() => {
                    const shots = document.shots.filter(
                      (s) => s.id !== active.id,
                    );
                    onChange({ ...document, shots });
                    setSelected(
                      shots[Math.min(index, shots.length - 1)]?.id || "",
                    );
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <label>
              镜头标题
              <input
                value={active.title}
                maxLength={120}
                onChange={(e) => update({ title: e.target.value })}
              />
            </label>
            <div className="form-row">
              <label>
                镜头类型
                <select
                  value={active.kind}
                  onChange={(e) => {
                    const kind = e.target.value as Shot["kind"];
                    if (kind === "DIALOGUE") {
                      const char = document.characters[0];
                      if (!char) {
                        onError("请先添加一位角色，再设置对白镜头。");
                        return;
                      }
                      update({
                        kind,
                        visibleCharacterIds: [
                          ...new Set([...active.visibleCharacterIds, char.id]),
                        ],
                        dialogue: active.dialogue || {
                          id: crypto.randomUUID(),
                          speakerId: char.id,
                          text: "",
                          emotion: "自然",
                          speed: 1,
                          delivery: "ON_SCREEN",
                        },
                      });
                    } else update({ kind, dialogue: null });
                  }}
                >
                  {Object.entries(kinds).map(([k, v]) => (
                    <option value={k} key={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                景别
                <select
                  value={active.framing}
                  onChange={(e) =>
                    update({ framing: e.target.value as Shot["framing"] })
                  }
                >
                  {Object.entries(framings).map(([k, v]) => (
                    <option value={k} key={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              所属场景
              <select
                value={active.sceneId}
                onChange={(e) => update({ sceneId: e.target.value })}
              >
                {document.scenes.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="field-label">出场人物</div>
            <div className="character-checks">
              {document.characters.map((c) => (
                <label key={c.id}>
                  <input
                    type="checkbox"
                    checked={active.visibleCharacterIds.includes(c.id)}
                    onChange={(e) => {
                      if (
                        !e.target.checked &&
                        active.dialogue?.speakerId === c.id &&
                        active.dialogue.delivery === "ON_SCREEN"
                      ) {
                        onError("画面内对白需要说话人出镜，或先改为画外音。");
                        return;
                      }
                      update({
                        visibleCharacterIds: e.target.checked
                          ? [...active.visibleCharacterIds, c.id]
                          : active.visibleCharacterIds.filter(
                              (id) => id !== c.id,
                            ),
                      });
                    }}
                  />
                  {c.name}
                </label>
              ))}
            </div>
            <label>
              画面与动作
              <textarea
                rows={4}
                value={active.description}
                onChange={(e) => update({ description: e.target.value })}
                maxLength={2000}
              />
            </label>
            {active.dialogue && (
              <div className="dialogue-settings">
                <h3>
                  <MessageSquare size={14} />
                  人物对白
                </h3>
                <div className="form-row">
                  <label>
                    说话角色
                    <select
                      value={active.dialogue.speakerId}
                      onChange={(e) =>
                        update({
                          dialogue: {
                            ...active.dialogue!,
                            speakerId: e.target.value,
                          },
                          visibleCharacterIds:
                            active.dialogue?.delivery === "ON_SCREEN"
                              ? [
                                  ...new Set([
                                    ...active.visibleCharacterIds,
                                    e.target.value,
                                  ]),
                                ]
                              : active.visibleCharacterIds,
                        })
                      }
                    >
                      {document.characters.map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    对白方式
                    <select
                      value={active.dialogue.delivery}
                      onChange={(e) =>
                        update({
                          dialogue: {
                            ...active.dialogue!,
                            delivery: e.target.value as
                              "ON_SCREEN" | "VOICE_OVER",
                          },
                          visibleCharacterIds:
                            e.target.value === "ON_SCREEN"
                              ? [
                                  ...new Set([
                                    ...active.visibleCharacterIds,
                                    active.dialogue!.speakerId,
                                  ]),
                                ]
                              : active.visibleCharacterIds,
                        })
                      }
                    >
                      <option value="ON_SCREEN">画面内对白</option>
                      <option value="VOICE_OVER">画外音</option>
                    </select>
                  </label>
                </div>
                <label>
                  对白内容
                  <textarea
                    rows={3}
                    value={active.dialogue.text}
                    maxLength={1000}
                    onChange={(e) =>
                      update({
                        dialogue: { ...active.dialogue!, text: e.target.value },
                      })
                    }
                  />
                </label>
                <label>
                  情绪与表演
                  <input
                    value={active.dialogue.emotion}
                    maxLength={200}
                    onChange={(e) =>
                      update({
                        dialogue: {
                          ...active.dialogue!,
                          emotion: e.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label>
                  期望语速
                  <select
                    value={active.dialogue.speed}
                    onChange={(e) =>
                      update({
                        dialogue: {
                          ...active.dialogue!,
                          speed: Number(e.target.value),
                        },
                      })
                    }
                  >
                    <option value={0.8}>缓慢 · 0.8</option>
                    <option value={0.9}>稍慢 · 0.9</option>
                    <option value={1}>自然 · 1.0</option>
                    <option value={1.1}>稍快 · 1.1</option>
                    <option value={1.2}>轻快 · 1.2</option>
                  </select>
                </label>
              </div>
            )}
            <label>
              预计镜头时长（秒）
              <input
                type="number"
                min={0.5}
                max={20}
                step={0.5}
                value={active.durationSeconds}
                onChange={(e) =>
                  update({ durationSeconds: Number(e.target.value) })
                }
              />
            </label>
            <p className="field-note">
              当前为编排预估，后续制作以实际音频长度校准。
            </p>
          </section>
        </div>
      )}
    </section>
  );
}
