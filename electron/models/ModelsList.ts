// Define provider types
export type ProviderType = "openai" | "gemini" | "ollama";

export type OpenAIModel = {
  id: string;
  name: string;
  description: string;
};

// Models organized by provider
export type ModelsByProvider = {
  [key in ProviderType]: {
    extractionModel: OpenAIModel[];
    solutionModel: OpenAIModel[];
    debuggingModel: OpenAIModel[];
  };
};

export const modelsByProvider: ModelsByProvider = {
  openai: {
    extractionModel: [
      {
        id: "gpt-4o",
        name: "gpt-4o",
        description: "Best overall performance for problem extraction",
      },
      {
        id: "gpt-4o-mini",
        name: "gpt-4o-mini",
        description: "Faster, more cost-effective option",
      },
    ],
    solutionModel: [
      {
        id: "gpt-4o",
        name: "gpt-4o",
        description: "Strong overall performance for coding tasks",
      },
      {
        id: "gpt-4o-mini",
        name: "gpt-4o-mini",
        description: "Faster, more cost-effective option",
      },
    ],
    debuggingModel: [
      {
        id: "gpt-4o",
        name: "gpt-4o",
        description: "Best for analyzing code and error messages",
      },
      {
        id: "gpt-4o-mini",
        name: "gpt-4o-mini",
        description: "Faster, more cost-effective option",
      },
    ],
  },
  gemini: {
    extractionModel: [
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Google's experimental model for fast responses",
      },
      {
        id: "gemini-2.0-flash-lite",
        name: "Gemini 2.0 Flash Lite",
        description: "Lightweight and faster version of Gemini 2.0 Flash",
      },
    ],
    solutionModel: [
      {
        id: "gemini-2.5-pro-exp-03-25",
        name: "Gemini 2.5 Pro Experimmental 03-25",
        description: "Experimental model for advanced coding tasks",
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Google's experimental model for fast responses",
      },
      {
        id: "gemini-2.0-flash-lite",
        name: "Gemini 2.0 Flash-Lite",
        description: "Lightweight and faster version of Gemini 2.0 Flash",
      },
      {
        id: "gemini-2.0-flash-thinking-exp-01-21",
        name: "Gemini 2.0 Flash Thinking Experimental 01-21",
        description: "Experimental thinking model for advanced coding tasks",
      },
    ],
    debuggingModel: [
      {
        id: "gemini-2.5-pro-exp-03-25",
        name: "Gemini 2.5 Pro Experimmental 03-25",
        description: "Experimental model for advanced coding tasks",
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Google's experimental model for fast responses",
      },
      {
        id: "gemini-2.0-flash-lite",
        name: "Gemini 2.0 Flash-Lite",
        description: "Lightweight and faster version of Gemini 2.0 Flash",
      },
      {
        id: "gemini-2.0-flash-thinking-exp-01-21",
        name: "Gemini 2.0 Flash Thinking Experimental 01-21",
        description: "Experimental thinking model for advanced coding tasks",
      },
      {
        id: "learnlm-1.5-pro-experimental",
        name: "LearnLM 1.5 Pro Experimental",
        description: "Experimental learning model for advanced coding tasks",
      },
    ],
  },
  ollama: {
    extractionModel: [
      {
        id: "llama3",
        name: "Llama 3",
        description: "Meta's latest open-source model",
      },
      {
        id: "mistral",
        name: "Mistral",
        description: "Fast and efficient alternative",
      },
    ],
    solutionModel: [
      {
        id: "llama3",
        name: "Llama 3",
        description: "Meta's latest open-source model",
      },
      {
        id: "codellama",
        name: "Code Llama",
        description: "Specialized for code generation",
      },
      {
        id: "starcoder2:3b",
        name: "Star Coder 2: 3B",
        description: "Optimized for code generation",
      },
      {
        id: "qwen2.5-coder:3b",
        name: "Qwen 2.5 Coder: 3B",
        description: "Qwen 2.5 Coder model",
      },
    ],
    debuggingModel: [
      {
        id: "llama3.2:latest",
        name: "Llama 3.2",
        description: "Meta's latest small, open-source model",
      },
      {
        id: "codellama",
        name: "Code Llama",
        description: "Specialized for code generation",
      },
    ],
  },
};
