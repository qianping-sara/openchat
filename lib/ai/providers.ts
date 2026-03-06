import { createAzure } from "@ai-sdk/azure";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  customProvider,
  defaultSettingsMiddleware,
  wrapLanguageModel,
} from "ai";
import { isTestEnvironment } from "../constants";

// Azure OpenAI 企业版 - Cognitive Services 格式
const azure = createAzure({
  baseURL: process.env.AZURE_OPENAI_BASE_URL,
  apiKey: process.env.AZURE_API_KEY,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? "2024-12-01-preview",
  useDeploymentBasedUrls: true,
});

const AZURE_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-5.2-chat";

// Google Gemini
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

export const myProvider = isTestEnvironment
  ? (() => {
      const { artifactModel, chatModel, titleModel } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : null;

export function getLanguageModel(modelId?: string) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("chat-model");
  }

  // 处理 Gemini 模型
  if (modelId?.startsWith("gemini/")) {
    const geminiModel = modelId.slice(7); // 移除 "gemini/" 前缀
    const baseModel = google(geminiModel);

    // 如果是 Gemini 3 Pro，启用 thinking 显示
    if (geminiModel.includes("gemini-3")) {
      return wrapLanguageModel({
        model: baseModel,
        middleware: defaultSettingsMiddleware({
          settings: {
            providerOptions: {
              google: {
                thinkingConfig: {
                  includeThoughts: true,
                },
              },
            },
          },
        }),
      });
    }

    return baseModel;
  }

  // 从 modelId (如 azure/gpt-5.2) 提取 deployment 名称
  const deployment = modelId?.startsWith("azure/")
    ? modelId.slice(6)
    : AZURE_DEPLOYMENT;

  const baseModel = azure.chat(deployment);

  // 如果是 reasoning 模型，使用 defaultSettingsMiddleware 添加 reasoning_effort
  // 注意：Azure 使用下划线命名 reasoning_effort，不是驼峰式 reasoningEffort
  // gpt-5.1 默认 reasoning_effort 是 'none'，必须显式设置才能看到 thinking
  if (isReasoningModel(modelId)) {
    return wrapLanguageModel({
      model: baseModel,
      middleware: defaultSettingsMiddleware({
        settings: {
          providerOptions: {
            azure: {
              reasoning_effort: "medium", // 可选值: 'low', 'medium', 'high'
            },
          },
        },
      }),
    });
  }

  return baseModel;
}

// 检查是否是 reasoning 模型
export function isReasoningModel(modelId?: string): boolean {
  const deployment = modelId?.startsWith("azure/")
    ? modelId.slice(6)
    : AZURE_DEPLOYMENT;
  const reasoningModels = ["gpt-5.2", "gpt-5.1", "gpt-5"];
  return reasoningModels.some((model) => deployment.includes(model));
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }
  return azure.chat(AZURE_DEPLOYMENT);
}

export function getArtifactModel(_kind?: "text" | "code" | "sheet") {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("artifact-model");
  }
  return azure.chat(AZURE_DEPLOYMENT);
}
