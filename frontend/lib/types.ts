export interface Character {
  id: string;
  name: string;
  description: string;
  appearance: string;
  costume: string;
  voiceId: string;
  referenceAssetId: string;
}
export interface Scene {
  id: string;
  name: string;
  description: string;
  lighting: string;
  blocking: string;
}
export interface Dialogue {
  id: string;
  speakerId: string;
  text: string;
  emotion: string;
  speed: number;
  delivery: "ON_SCREEN" | "VOICE_OVER";
}
export interface Shot {
  id: string;
  sceneId: string;
  title: string;
  kind: "DIALOGUE" | "REACTION" | "ESTABLISHING";
  framing: "CLOSEUP" | "MEDIUM" | "WIDE" | "OVER_SHOULDER";
  description: string;
  visibleCharacterIds: string[];
  durationSeconds: number;
  dialogue: Dialogue | null;
}
export interface StoryDocument {
  story: string;
  script: string;
  characters: Character[];
  scenes: Scene[];
  shots: Shot[];
}
export interface Project {
  id: string;
  title: string;
  logline: string;
  genre: string;
  targetDuration: number;
  revision: number;
  archived: boolean;
  document: StoryDocument;
  createdAt: string;
  updatedAt: string;
}
export interface Revision {
  revision: number;
  title: string;
  logline: string;
  genre: string;
  targetDuration: number;
  document: StoryDocument;
  summary: string;
  createdAt: string;
}
export interface User {
  id: string;
  username: string;
}
export interface Asset {
  id: string;
  projectId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  url: string;
}
export interface SystemInfo {
  name: string;
  stage: number;
  aiConfigured: boolean;
  textModel: string;
  videoGenerationAvailable: boolean;
}
export interface VoiceBinding {
  characterId: string;
  voiceId: string;
  version: number;
}
export interface SpeechJob {
  id: string;
  shotId: string;
  dialogueId: string;
  characterId: string;
  characterName: string;
  text: string;
  emotion: string;
  speed: number;
  voiceId: string;
  projectRevision: number;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  errorMessage: string;
  durationSeconds: number;
  stale: boolean;
  url: string;
  createdAt: string;
}
export interface SpeechState {
  configured: boolean;
  provider: string;
  voices: { id: string; name: string; description: string }[];
  bindings: VoiceBinding[];
  jobs: SpeechJob[];
}
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}
export interface Conversation {
  projectId: string;
  version: number;
  baseRevision: number;
  currentRevision: number;
  document: StoryDocument;
  messages: ChatMessage[];
  processing: boolean;
  pendingPrompt: string;
  stale: boolean;
  hasChanges: boolean;
  updatedAt: string;
  memory: WritingMemory;
}
export interface WritingMemory {
  requirements: string[];
  summary: string;
  suggestions: string[];
  revokedRequirements: string[];
  updatedAt: string | null;
}
export interface ConversationSaved {
  project: Project;
  conversation: Conversation;
}
