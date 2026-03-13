// 企业版 Azure OpenAI - 单一模型
export const DEFAULT_CHAT_MODEL = "azure/gpt-5.3-chat";

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
};

export const chatModels: ChatModel[] = [
  // {
  //   id: "azure/gpt-5.2-chat",
  //   name: "GPT-5.2 Chat",
  //   provider: "azure",
  //   description: "128K 上下文，128K 输出",
  // },
  {
    id: "azure/gpt-5.4",
    name: "GPT-5.4",
    provider: "azure",
    description: "",
  },
  // {
  //   id: "azure/gpt-5.3-chat",
  //   name: "GPT-5.3 Chat",
  //   provider: "azure",
  //   description: "128K 上下文，128K 输出",
  // },
  // {
  //   id: "gemini/gemini-3-pro-preview",
  //   name: "Gemini 3 Pro",
  //   provider: "gemini",
  //   description: "2M 上下文，高级推理能力",
  // },
];

// Group models by provider for UI
export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  },
  {} as Record<string, ChatModel[]>
);
