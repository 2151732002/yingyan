import type { StoryDocument } from "./types";
export function sampleDocument(): StoryDocument {
  return {
    story:
      "雨夜，林夏在即将打烊的咖啡馆等到了陈默。他第二天就要离开这座城市，两个人都没有先提起这件事。直到杯中的咖啡凉了，她终于问出了那句话。",
    script:
      "【雨夜，咖啡馆窗边。暖色灯光，窗外雨声。】\n\n林夏（克制）：你真的要走？\n\n陈默低头看着杯子，停顿。\n\n陈默（低声）：我会回来。\n\n林夏没有回答。镜头停在两人之间的空位。",
    characters: [
      {
        id: "linxia",
        name: "林夏",
        description: "28岁，咖啡馆店主。习惯把情绪藏在平静的语气里。",
        appearance: "黑色及肩长发，五官柔和，神情克制。",
        costume: "米色风衣，白色衬衫。",
        voiceId: "温柔女声，克制、轻声",
        referenceAssetId: "",
      },
      {
        id: "chenmo",
        name: "陈默",
        description: "30岁，摄影师。即将离开，想说很多话又不知如何开口。",
        appearance: "黑色短发，清瘦，有一点疲惫。",
        costume: "深灰色外套。",
        voiceId: "低沉男声，缓慢、自然",
        referenceAssetId: "",
      },
    ],
    scenes: [
      {
        id: "cafe",
        name: "雨夜咖啡馆",
        description: "靠窗双人座，两杯已经凉掉的咖啡，窗外霓虹被雨水模糊。",
        lighting: "室内柔和暖光，窗外冷色雨夜。",
        blocking: "林夏在画面左侧，陈默在右侧，相向而坐。",
      },
    ],
    shots: [
      {
        id: "shot1",
        sceneId: "cafe",
        title: "最后的问题",
        kind: "DIALOGUE",
        framing: "CLOSEUP",
        description: "林夏看向画面右侧，指尖握着咖啡杯，缓缓抬眼。",
        visibleCharacterIds: ["linxia"],
        durationSeconds: 7,
        dialogue: {
          id: "line1",
          speakerId: "linxia",
          text: "你真的要走？",
          emotion: "克制，带一点不舍",
          speed: 0.9,
          delivery: "ON_SCREEN",
        },
      },
      {
        id: "shot2",
        sceneId: "cafe",
        title: "没有说出口",
        kind: "REACTION",
        framing: "CLOSEUP",
        description: "陈默低头，视线从杯子移向窗外，沉默片刻。",
        visibleCharacterIds: ["chenmo"],
        durationSeconds: 4,
        dialogue: null,
      },
      {
        id: "shot3",
        sceneId: "cafe",
        title: "一个承诺",
        kind: "DIALOGUE",
        framing: "MEDIUM",
        description: "陈默重新看向林夏，身体微微前倾。",
        visibleCharacterIds: ["chenmo"],
        durationSeconds: 7,
        dialogue: {
          id: "line2",
          speakerId: "chenmo",
          text: "我会回来。",
          emotion: "低声，认真而迟疑",
          speed: 0.9,
          delivery: "ON_SCREEN",
        },
      },
      {
        id: "shot4",
        sceneId: "cafe",
        title: "雨还在下",
        kind: "ESTABLISHING",
        framing: "WIDE",
        description: "两人相向而坐，镜头缓慢后拉，雨水划过玻璃。",
        visibleCharacterIds: ["linxia", "chenmo"],
        durationSeconds: 5,
        dialogue: null,
      },
    ],
  };
}
