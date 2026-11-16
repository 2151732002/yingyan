"use client";
import { BookOpen, Clapperboard, Plus, Trash2 } from "lucide-react";
import type { StoryDocument } from "@/lib/types";
import { countWords } from "@/lib/editor";
export function StoryPanel({
  document,
  onChange,
  onSample,
  onError,
}: {
  document: StoryDocument;
  onChange: (d: StoryDocument) => void;
  onSample: () => void;
  onError: (message: string) => void;
}) {
  function addScene() {
    if (document.scenes.length >= 4) return;
    onChange({
      ...document,
      scenes: [
        ...document.scenes,
        {
          id: crypto.randomUUID(),
          name: `场景 ${document.scenes.length + 1}`,
          description: "",
          lighting: "",
          blocking: "",
        },
      ],
    });
  }
  function removeScene(id: string) {
    if (document.shots.some((s) => s.sceneId === id)) {
      onError("这个场景正在被镜头使用，请先调整相关分镜。");
      return;
    }
    onChange({
      ...document,
      scenes: document.scenes.filter((s) => s.id !== id),
    });
  }
  return (
    <div className="story-panel">
      <div className="editor-page-heading">
        <div>
          <span className="eyebrow">01 / THE STORY</span>
          <h1>先把故事，写下来。</h1>
          <p>不必一次写得完美。人物与镜头，会在文字里慢慢清晰。</p>
        </div>
        <button className="btn secondary" onClick={onSample}>
          <BookOpen size={15} />
          载入示例剧本
        </button>
      </div>
      <div className="story-writing-grid">
        <section className="paper-panel">
          <div className="panel-title">
            <span>
              <BookOpen size={16} />
              故事梗概
            </span>
            <small>{countWords(document.story)} 字</small>
          </div>
          <label className="sr-only" htmlFor="story">
            故事梗概
          </label>
          <textarea
            id="story"
            className="story-textarea"
            placeholder="雨夜，一间即将打烊的咖啡馆。两个人隔着一张桌子，谁都没有先说出那句话……"
            value={document.story}
            onChange={(e) => onChange({ ...document, story: e.target.value })}
            maxLength={30000}
          />
          <div className="writing-note">
            人物是谁？他们想要什么？是什么让这场相遇变得重要？
          </div>
        </section>
        <section className="paper-panel script-panel">
          <div className="panel-title">
            <span>
              <Clapperboard size={16} />
              剧本文稿
            </span>
            <small>对白 / 动作 / 场景</small>
          </div>
          <label className="sr-only" htmlFor="script">
            剧本文稿
          </label>
          <textarea
            id="script"
            className="script-textarea"
            placeholder={
              "【场景描述】\n\n角色 A（情绪）：一句对白。\n\n角色 B 的动作与反应。"
            }
            value={document.script}
            onChange={(e) => onChange({ ...document, script: e.target.value })}
            maxLength={30000}
          />
        </section>
      </div>
      <section className="scenes-section">
        <div className="section-title">
          <div>
            <h2>
              故事发生的地方 <span>SCENES</span>
            </h2>
            <p>记录光线、环境与人物站位，让每个镜头都能衔接。</p>
          </div>
          <button
            className="btn secondary small"
            disabled={document.scenes.length >= 4}
            onClick={addScene}
          >
            <Plus size={14} />
            添加场景
          </button>
        </div>
        <div className="scene-grid">
          {document.scenes.length === 0 ? (
            <div className="scene-empty">
              <span>还没有场景</span>
              <p>添加第一个场景后，就可以开始编排镜头。</p>
            </div>
          ) : (
            document.scenes.map((scene, i) => (
              <article className="scene-card" key={scene.id}>
                <div className="scene-card-heading">
                  <span>SCENE {String(i + 1).padStart(2, "0")}</span>
                  <button
                    className="icon-btn"
                    aria-label={`删除场景 ${scene.name}`}
                    onClick={() => removeScene(scene.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <label>
                  场景名称
                  <input
                    value={scene.name}
                    onChange={(e) =>
                      onChange({
                        ...document,
                        scenes: document.scenes.map((s) =>
                          s.id === scene.id
                            ? { ...s, name: e.target.value }
                            : s,
                        ),
                      })
                    }
                    maxLength={100}
                  />
                </label>
                {(["description", "lighting", "blocking"] as const).map(
                  (key) => (
                    <label key={key}>
                      {
                        {
                          description: "环境描述",
                          lighting: "光线氛围",
                          blocking: "人物站位",
                        }[key]
                      }
                      <textarea
                        rows={key === "description" ? 3 : 2}
                        value={scene[key]}
                        maxLength={key === "description" ? 2000 : 500}
                        onChange={(e) =>
                          onChange({
                            ...document,
                            scenes: document.scenes.map((s) =>
                              s.id === scene.id
                                ? { ...s, [key]: e.target.value }
                                : s,
                            ),
                          })
                        }
                      />
                    </label>
                  ),
                )}
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
