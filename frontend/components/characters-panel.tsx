"use client";
import { useRef, useState } from "react";
import {
  ImagePlus,
  LoaderCircle,
  Plus,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Asset, Character, StoryDocument } from "@/lib/types";
export function CharactersPanel({
  projectId,
  document,
  assets,
  onChange,
  onAsset,
  onError,
}: {
  projectId: string;
  document: StoryDocument;
  assets: Asset[];
  onChange: (d: StoryDocument) => void;
  onAsset: (a: Asset, characterId: string) => void;
  onError: (message: string) => void;
}) {
  const [uploading, setUploading] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const target = useRef("");
  function update(id: string, patch: Partial<Character>) {
    onChange({
      ...document,
      characters: document.characters.map((c) =>
        c.id === id ? { ...c, ...patch } : c,
      ),
    });
  }
  function add() {
    onChange({
      ...document,
      characters: [
        ...document.characters,
        {
          id: crypto.randomUUID(),
          name: `新角色 ${document.characters.length + 1}`,
          description: "",
          appearance: "",
          costume: "",
          voiceId: "",
          referenceAssetId: "",
        },
      ],
    });
  }
  function remove(id: string) {
    if (
      document.shots.some(
        (s) =>
          s.visibleCharacterIds.includes(id) || s.dialogue?.speakerId === id,
      )
    ) {
      onError("这个角色正在分镜中出场，请先调整相关镜头和台词。");
      return;
    }
    onChange({
      ...document,
      characters: document.characters.filter((c) => c.id !== id),
    });
  }
  async function upload(file: File | undefined) {
    if (!file || uploading) return;
    const id = target.current;
    if (
      !["image/jpeg", "image/png"].includes(file.type) ||
      file.size > 5242880 ||
      file.size === 0
    ) {
      onError("请选择不超过 5MB 的 JPEG 或 PNG 图片");
      return;
    }
    setUploading(id);
    try {
      const body = new FormData();
      body.set("file", file);
      const asset = await api<Asset>(`/projects/${projectId}/assets`, {
        method: "POST",
        body,
      });
      onAsset(asset, id);
    } catch (e) {
      onError(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(null);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <section className="characters-panel">
      <div className="editor-page-heading">
        <div>
          <span className="eyebrow">02 / THE CHARACTERS</span>
          <h1>先认识，故事里的人。</h1>
          <p>固定人物的外貌、服装与声音，让每一次出场都有迹可循。</p>
        </div>
        <button
          className="btn primary"
          onClick={add}
          disabled={document.characters.length >= 2}
        >
          <Plus size={15} />
          添加角色
        </button>
      </div>
      {document.characters.length === 0 ? (
        <div className="panel-empty">
          <UserRound size={34} />
          <h2>为故事，找到第一个人</h2>
          <p>首版支持两名主要角色，可以先填写设定，之后再补充参考图。</p>
          <button className="btn secondary" onClick={add}>
            <Plus size={15} />
            添加第一个角色
          </button>
        </div>
      ) : (
        <div className="character-grid">
          {document.characters.map((c, i) => {
            const reference = assets.find((a) => a.id === c.referenceAssetId);
            return (
              <article className="character-card" key={c.id}>
                <div className={`character-portrait portrait-${i}`}>
                  {reference ? (
                    <img src={reference.url} alt={`${c.name}参考图`} />
                  ) : (
                    <div className="character-silhouette">
                      <UserRound size={80} strokeWidth={0.7} />
                      <span>角色参考图</span>
                    </div>
                  )}
                  <span className="character-number">
                    CHARACTER {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="portrait-actions">
                    <button
                      onClick={() => {
                        target.current = c.id;
                        input.current?.click();
                      }}
                      disabled={!!uploading}
                    >
                      {uploading === c.id ? (
                        <LoaderCircle size={14} className="spin" />
                      ) : (
                        <ImagePlus size={14} />
                      )}{" "}
                      {reference ? "更换参考图" : "上传参考图"}
                    </button>
                    {reference && (
                      <button
                        aria-label={`移除${c.name}参考图`}
                        onClick={() => update(c.id, { referenceAssetId: "" })}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="character-fields">
                  <div className="character-header">
                    <span>人物设定</span>
                    <button
                      className="icon-btn"
                      aria-label={`删除角色 ${c.name}`}
                      onClick={() => remove(c.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <label>
                    角色姓名
                    <input
                      value={c.name}
                      onChange={(e) => update(c.id, { name: e.target.value })}
                      maxLength={60}
                    />
                  </label>
                  <label>
                    人物小传
                    <textarea
                      rows={3}
                      value={c.description}
                      onChange={(e) =>
                        update(c.id, { description: e.target.value })
                      }
                      maxLength={1000}
                      placeholder="身份、性格，以及藏在心里的事。"
                    />
                  </label>
                  <div className="form-row">
                    <label>
                      外貌特征
                      <textarea
                        rows={3}
                        value={c.appearance}
                        onChange={(e) =>
                          update(c.id, { appearance: e.target.value })
                        }
                        maxLength={1000}
                      />
                    </label>
                    <label>
                      服装设定
                      <textarea
                        rows={3}
                        value={c.costume}
                        onChange={(e) =>
                          update(c.id, { costume: e.target.value })
                        }
                        maxLength={500}
                      />
                    </label>
                  </div>
                  <label>
                    声音设定
                    <input
                      value={c.voiceId}
                      onChange={(e) =>
                        update(c.id, { voiceId: e.target.value })
                      }
                      maxLength={100}
                      placeholder="例如：低沉男声，缓慢自然"
                    />
                  </label>
                  <p className="field-note">
                    先记录声音特征；真实音色试听将在配音阶段接入。
                  </p>
                  {assets.length > 0 && (
                    <label>
                      选择已上传素材
                      <select
                        value={c.referenceAssetId}
                        onChange={(e) =>
                          update(c.id, { referenceAssetId: e.target.value })
                        }
                      >
                        <option value="">暂不使用参考图</option>
                        {assets.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.fileName} · {a.width}×{a.height}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      <input
        type="file"
        ref={input}
        accept="image/jpeg,image/png"
        className="sr-only"
        aria-label="上传角色参考图"
        onChange={(e) => void upload(e.target.files?.[0])}
      />
    </section>
  );
}
