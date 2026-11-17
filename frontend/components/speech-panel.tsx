"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Headphones,
  LoaderCircle,
  Play,
  RefreshCw,
  Square,
} from "lucide-react";
import { api, ApiError, date, send } from "@/lib/api";
import type {
  Project,
  SpeechJob,
  SpeechState,
  VoiceBinding,
} from "@/lib/types";
import { ErrorMessage, Loading } from "./ui";

const busy = (job?: SpeechJob) =>
  job?.status === "QUEUED" || job?.status === "RUNNING";
const status = {
  QUEUED: "排队中",
  RUNNING: "生成中",
  SUCCEEDED: "已生成",
  FAILED: "生成失败",
};

export function SpeechPanel({
  project,
  dirty,
  saving,
  onNormalizeSpeed,
  onReload,
}: {
  project: Project;
  dirty: boolean;
  saving: boolean;
  onNormalizeSpeed: () => void;
  onReload: () => void;
}) {
  const client = useQueryClient();
  const key = ["speech", project.id];
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) =>
      api<SpeechState>(`/projects/${project.id}/speech`, { signal }),
    refetchInterval: (q) => (q.state.data?.jobs.some(busy) ? 1500 : false),
  });
  const generate = useMutation({
    mutationFn: ({
      shotId,
      voiceVersion,
      preview,
    }: {
      shotId?: string;
      voiceVersion?: number;
      preview?: string;
    }) =>
      send<SpeechJob>(
        `/projects/${project.id}/speech/${preview ? "previews" : "jobs"}`,
        preview
          ? { expectedRevision: project.revision, voiceId: preview }
          : {
              expectedRevision: project.revision,
              shotId,
              expectedVoiceVersion: voiceVersion,
            },
      ),
    onMutate: () => {
      setError("");
      setConflict(false);
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: key });
    },
    onError: (e) => {
      setError(e.message);
      setConflict(e instanceof ApiError && e.status === 409);
      void client.invalidateQueries({ queryKey: key });
    },
  });
  if (query.isPending) return <Loading />;
  if (!query.data)
    return (
      <div>
        <ErrorMessage message={query.error?.message || "无法读取配音"} />
        <button className="btn secondary" onClick={() => void query.refetch()}>
          重试读取配音
        </button>
      </div>
    );
  const state = query.data;
  const lines = project.document.shots.filter((s) => s.dialogue?.text.trim());
  const ready = lines.map((s) =>
    state.jobs.find(
      (j) => j.shotId === s.id && j.status === "SUCCEEDED" && !j.stale,
    ),
  );
  const sequence = ready.filter((j): j is SpeechJob => !!j);
  const disabled = dirty || generate.isPending || !state.configured;
  return (
    <section className="speech-panel">
      <div className="editor-page-heading">
        <div>
          <span className="eyebrow">04 / FIND THEIR VOICE</span>
          <h1>让角色，拥有自己的声音。</h1>
          <p>先选音色，再逐句打磨。任务在后台继续，回来即可试听。</p>
        </div>
        <button
          className="btn secondary"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw size={16} />
          刷新配音状态
        </button>
      </div>
      {dirty && (
        <div className="speech-notice" role="status">
          有尚未保存的更改。请先保存项目版本，再选择音色或生成配音；下方展示已保存版本的配音状态。
        </div>
      )}
      {lines.some((shot) => shot.dialogue!.speed !== 1) && (
        <div className="speech-notice">
          <p>
            有 {lines.filter((shot) => shot.dialogue!.speed !== 1).length}{" "}
            句台词的语速不是
            1.0，当前服务仅支持原速。可在这里统一修改并保存为新版本，无需逐个查找镜头。
          </p>
          <button
            className="btn secondary"
            disabled={dirty || saving}
            onClick={onNormalizeSpeed}
          >
            {saving ? "正在保存原速…" : "统一为原速并保存"}
          </button>
          <p className="field-note">
            只调整有台词镜头的语速，保留原版本，不会生成配音。
            {dirty ? "请先保存页面中其他未保存的更改。" : ""}
          </p>
        </div>
      )}
      {!state.configured && (
        <div className="speech-notice">
          尚未配置语音服务。后端使用 DeepSeek 时会沿用现有 Key，也可单独配置
          SPEECH_API_KEY。配置后重启后端即可使用。
        </div>
      )}
      <p className="field-note">
        {state.provider} · 当前提供两种音色，仅支持原速
        1.0，情绪描述暂不参与合成。每次点击生成或音色试听都会调用语音服务，平台不会自动重试。
      </p>
      {(error || query.error) && (
        <ErrorMessage message={error || query.error!.message} />
      )}
      {conflict && (
        <button className="btn secondary" onClick={onReload}>
          载入项目最新版本
        </button>
      )}
      <div className="speech-voices">
        {project.document.characters.map((c) => (
          <VoiceCard
            key={c.id}
            character={c}
            binding={state.bindings.find((b) => b.characterId === c.id)}
            voices={state.voices}
            project={project}
            dirty={dirty}
          />
        ))}
        {!project.document.characters.length && (
          <p>先在角色页添加角色并保存，再为人物选择声音。</p>
        )}
      </div>
      <div className="speech-previews">
        <strong>
          <Headphones size={17} />
          音色试听
        </strong>
        <span>使用固定示例句，不发送你的故事。</span>
        {state.voices.map((v) => {
          const j = state.jobs.find((j) => j.shotId === `preview-${v.id}`);
          return (
            <div key={v.id}>
              <button
                className="btn secondary small"
                disabled={disabled || busy(j)}
                onClick={() => generate.mutate({ preview: v.id })}
              >
                {busy(j) ? (
                  <LoaderCircle className="spin" size={14} />
                ) : (
                  <Play size={14} />
                )}
                {busy(j) ? status[j!.status] : `试听 ${v.name}`}
              </button>
              {j?.status === "SUCCEEDED" && (
                <audio
                  controls
                  preload="none"
                  src={j.url}
                  aria-label={`${v.name}示例音频`}
                />
              )}
              {j?.status === "FAILED" && (
                <small role="alert">{j.errorMessage}</small>
              )}
            </div>
          );
        })}
      </div>
      <SequencePlayer
        key={`${project.revision}-${dirty}-${state.bindings.map((b) => `${b.characterId}:${b.version}`).join()}`}
        jobs={sequence}
        disabled={dirty || !lines.length || sequence.length !== lines.length}
      />
      <div className="speech-lines">
        {lines.map((shot, i) => {
          const line = shot.dialogue!;
          const character = project.document.characters.find(
            (c) => c.id === line.speakerId,
          );
          const binding = state.bindings.find(
            (b) => b.characterId === line.speakerId,
          );
          const jobs = state.jobs.filter((j) => j.shotId === shot.id);
          const active = jobs.find(busy);
          const latest = jobs[0];
          return (
            <article
              className="speech-line"
              key={shot.id}
              data-testid={`speech-${shot.id}`}
            >
              <div className="speech-line-heading">
                <span className="eyebrow">
                  {String(i + 1).padStart(2, "0")} / {shot.title}
                </span>
                <span>
                  {character?.name || "未知角色"} ·{" "}
                  {binding
                    ? state.voices.find((v) => v.id === binding.voiceId)?.name
                    : "未选择音色"}
                </span>
              </div>
              <blockquote>{line.text}</blockquote>
              <div className="speech-line-actions">
                <span className="field-note">
                  {line.delivery === "VOICE_OVER" ? "画外音" : "画面内对白"} ·{" "}
                  {line.emotion || "自然表达"} · 语速 {line.speed}
                </span>
                <button
                  className="btn primary small"
                  disabled={
                    disabled || !!active || !binding || line.speed !== 1
                  }
                  onClick={() =>
                    generate.mutate({
                      shotId: shot.id,
                      voiceVersion: binding!.version,
                    })
                  }
                >
                  {active ? (
                    <LoaderCircle className="spin" size={15} />
                  ) : (
                    <Headphones size={15} />
                  )}
                  {active
                    ? status[active.status]
                    : latest
                      ? "重新生成这句"
                      : "生成这句"}
                </button>
              </div>
              {line.speed !== 1 && (
                <p className="field-note">
                  当前服务不支持此语速，请使用上方「统一为原速并保存」，或在分镜中修改这句台词的语速。
                </p>
              )}
              {latest && <JobAudio job={latest} />}
              {jobs.length > 1 && (
                <details className="speech-history">
                  <summary role="button">历史配音（{jobs.length}）</summary>
                  {jobs.slice(1).map((j) => (
                    <JobAudio key={j.id} job={j} history />
                  ))}
                </details>
              )}
            </article>
          );
        })}
        {!lines.length && (
          <div className="panel-empty">
            <Headphones size={30} />
            <h2>还没有可以配音的台词</h2>
            <p>在分镜页添加对白、设置说话角色并保存项目，再回到这里。</p>
          </div>
        )}
      </div>
      <p className="field-note">
        展示最近 200
        条配音与试听记录；旧音频保留，不会覆盖。配音试听尚不包含口型、画面和视频合成。
      </p>
    </section>
  );
}

function VoiceCard({
  character,
  binding,
  voices,
  project,
  dirty,
}: {
  character: Project["document"]["characters"][number];
  binding?: VoiceBinding;
  voices: SpeechState["voices"];
  project: Project;
  dirty: boolean;
}) {
  const client = useQueryClient();
  // Remount the editable selection only after a successful server version change.
  return (
    <VoiceSelection
      key={`${binding?.version || 0}`}
      character={character}
      binding={binding}
      voices={voices}
      project={project}
      dirty={dirty}
      refresh={() => {
        void client.invalidateQueries({ queryKey: ["speech", project.id] });
      }}
    />
  );
}
function VoiceSelection({
  character,
  binding,
  voices,
  project,
  dirty,
  refresh,
}: {
  character: Project["document"]["characters"][number];
  binding?: VoiceBinding;
  voices: SpeechState["voices"];
  project: Project;
  dirty: boolean;
  refresh: () => void;
}) {
  const [voice, setVoice] = useState(binding?.voiceId || "");
  const save = useMutation({
    mutationFn: () =>
      send(
        `/projects/${project.id}/speech/voices/${character.id}`,
        {
          expectedRevision: project.revision,
          expectedVersion: binding?.version || 0,
          voiceId: voice,
        },
        "PUT",
      ),
    onSuccess: refresh,
  });
  return (
    <div className="speech-voice-card">
      <h2>{character.name}</h2>
      <p>{character.voiceId || "为这个角色选择一个稳定的声音。"}</p>
      <label>
        {character.name}的配音音色
        <select
          value={voice}
          onChange={(e) => setVoice(e.target.value)}
          disabled={dirty || save.isPending}
        >
          <option value="">请选择音色</option>
          {voices.map((v) => (
            <option value={v.id} key={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </label>
      <div>
        <button
          className="btn secondary small"
          disabled={
            dirty || !voice || voice === binding?.voiceId || save.isPending
          }
          onClick={() => save.mutate()}
          aria-label={`保存${character.name}的音色`}
        >
          {save.isPending ? "保存中…" : "保存音色"}
        </button>
        {binding && <small role="status">音色已保存</small>}
      </div>
      {save.error && <ErrorMessage message={save.error.message} />}
    </div>
  );
}

function JobAudio({
  job,
  history = false,
}: {
  job: SpeechJob;
  history?: boolean;
}) {
  return (
    <div className={`speech-audio ${job.stale ? "stale" : ""}`}>
      <div>
        <strong>{status[job.status]}</strong>
        {job.stale && <span className="speech-stale">已过期</span>}
        <small>
          V{job.projectRevision} · {job.voiceId} · {date(job.createdAt)}
          {job.durationSeconds > 0
            ? ` · ${job.durationSeconds.toFixed(1)} 秒`
            : ""}
        </small>
      </div>
      {history && (
        <p>
          {job.characterName}：{job.text}
        </p>
      )}
      {job.stale && (
        <p className="field-note">
          台词、角色、音色或表演设定已变化。这是旧版本配音。
        </p>
      )}
      {job.status === "SUCCEEDED" && (
        <audio
          controls
          preload="none"
          src={job.url}
          aria-label={`${job.characterName}的配音`}
        />
      )}
      {job.status === "FAILED" && <p role="alert">{job.errorMessage}</p>}
      {busy(job) && (
        <p className="field-note">可以离开页面，任务会在后台继续。</p>
      )}
    </div>
  );
}

function SequencePlayer({
  jobs,
  disabled,
}: {
  jobs: SpeechJob[];
  disabled: boolean;
}) {
  const player = useRef<HTMLAudioElement>(null);
  const queue = useRef<SpeechJob[]>([]);
  const position = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [label, setLabel] = useState("");
  const [pause, setPause] = useState(0.5);
  const [error, setError] = useState("");
  useEffect(
    () => () => {
      active.current = false;
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function stop() {
    active.current = false;
    if (timer.current) clearTimeout(timer.current);
    player.current?.pause();
    setPlaying(false);
    setLabel("");
  }
  function next() {
    const job = queue.current[position.current];
    if (!job || !active.current || !player.current) {
      stop();
      return;
    }
    setLabel(`${job.characterName}：${job.text}`);
    player.current.src = job.url;
    void player.current.play().catch(() => {
      if (active.current) {
        stop();
        setError("音频播放失败，请检查连接或单独试听。");
      }
    });
  }
  return (
    <div className="speech-sequence">
      <div>
        <h2>连起来，听一遍。</h2>
        <p>按分镜顺序播放当前有效配音，句间留一点呼吸。</p>
      </div>
      <label>
        句间停顿
        <select
          value={pause}
          disabled={playing}
          onChange={(e) => setPause(Number(e.target.value))}
        >
          <option value={0}>无停顿</option>
          <option value={0.3}>0.3 秒</option>
          <option value={0.5}>0.5 秒</option>
          <option value={1}>1 秒</option>
          <option value={2}>2 秒</option>
        </select>
      </label>
      <button
        className="btn secondary"
        disabled={disabled && !playing}
        onClick={() => {
          if (playing) {
            stop();
            return;
          }
          queue.current = [...jobs];
          position.current = 0;
          active.current = true;
          setPlaying(true);
          setError("");
          next();
        }}
      >
        {playing ? <Square size={15} /> : <Play size={15} />}
        {playing ? "停止连听" : "顺序试听"}
      </button>
      {disabled && <small>所有台词有有效配音并保存项目后即可连听。</small>}
      {playing && (
        <p className="speech-now-playing" role="status">
          {label}
        </p>
      )}
      {error && <ErrorMessage message={error} />}
      <audio
        ref={player}
        preload="none"
        onEnded={() => {
          position.current += 1;
          timer.current = setTimeout(next, pause * 1000);
        }}
        onError={() => {
          if (active.current) {
            stop();
            setError("音频加载失败，请稍后重试。");
          }
        }}
      />
    </div>
  );
}
