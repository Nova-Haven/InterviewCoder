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

// For Ollama use at least 11B on the extraction model, otherwise it will return
// incorrect results and will likely allucinate the code or return nothing at all.
// For the solution model, use at least 4B for the best results.
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
        id: "llama3.2-vision:11b",
        name: "Llama 3.2 Vision: 11B",
        description: "Most capable model for code extraction from screenshots.",
      },
      /*{
        id: "gemma3:4b-it-fp16",
        name: "Gemma 3: 4B Instruct",
        description:
          "Good balance of speed and capability for code extraction.",
      },
      {
        id: "llava-phi3:3.8b",
        name: "LLaVA Phi3: 3.8B",
        description: "Fast model with good code understanding capabilities.",
      },
      {
        id: "granite3.2-vision:latest",
        name: "Granite 3.2 Vision: 2B",
        description:
          "Specialized for document understanding, good for structured code.",
      },*/
    ],
    solutionModel: [
      {
        id: "llama3.2:1b",
        name: "Llama 3.2: 1B",
        description: "Meta's latest small, open-source model. Quickest model.",
      },
      {
        id: "gemma3:1b-it-fp16",
        name: "Gemma 3: 1B Instruct Full Precision",
        description:
          "The current, most capable model that runs on a single GPU. Faster but less capable.",
      },
      {
        id: "qwen2:1.5b",
        name: "Qwen 2: 1.5B",
        description: "Qwen 2 model for code generation",
      },
      {
        id: "deepseek-r1:1.5b-qwen-distill-fp16",
        name: "DeepSeek R1: 1.5B Qwen Distill Full Precision",
        description: "DeepSeek's R1 distilled small model for code generation",
      },
      {
        id: "starcoder2:3b",
        name: "Star Coder 2: 3B",
        description: "Optimized for code generation",
      },
      {
        id: "llama3.2:latest",
        name: "Llama 3.2",
        description: "Meta's latest small, open-source model",
      },
      {
        id: "qwen2.5-coder:3b",
        name: "Qwen 2.5 Coder: 3B",
        description: "Qwen 2.5 Coder model",
      },
      {
        id: "gemma3:4b-it-fp16",
        name: "Gemma 3: 4B Instruct Full Precision",
        description:
          "The current, most capable model that runs on a single GPU.",
      },
      {
        id: "deepseek-coder:6.7b",
        name: "DeepSeek Coder: 6.7B",
        description: "DeepSeek's Coder model for code generation",
      },
      {
        id: "deepseek-r1:7b",
        name: "DeepSeek R1: 7B",
        description: "DeepSeek's R1 model for code debugging",
      },
      {
        id: "codellama:7b",
        name: "Code Llama",
        description: "Specialized for code generation",
      },
      {
        id: "llama3:8b",
        name: "Llama 3",
        description: "Meta's latest open-source model",
      },
      {
        id: "gemma3:12b",
        name: "Gemma 3: 12B",
        description:
          "The current, most capable model that runs on a single GPU. Takes longer to load.",
      },
    ],
    debuggingModel: [
      {
        id: "qwen2.5-coder:3b",
        name: "Qwen 2.5 Coder: 3B",
        description: "Qwen 2.5 Coder model",
      },
      {
        id: "llama3.2:latest",
        name: "Llama 3.2",
        description: "Meta's latest small, open-source model",
      },
      {
        id: "gemma3:4b-it-fp16",
        name: "Gemma 3: 4B Instruct Full Precision",
        description:
          "The current, most capable model that runs on a single GPU.",
      },
      {
        id: "deepseek-coder:6.7b",
        name: "DeepSeek Coder: 6.7B",
        description: "DeepSeek's Coder model for code generation",
      },
      {
        id: "huihui_ai/qwen2.5-1m-abliterated:7b-instruct",
        name: "Qwen 2.5 7B Instruct, with 1M token context",
        description: "Qwen 2.5 Abliterated model for code generation",
      },
      {
        id: "qwen2.5-coder:latest",
        name: "Qwen 2.5 Coder",
        description: "Qwen 2.5 Coder model",
      },
      {
        id: "codellama:7b",
        name: "Code Llama",
        description: "Specialized for code generation",
      },
      {
        id: "deepseek-r1:7b",
        name: "DeepSeek R1: 7B",
        description: "DeepSeek's R1 model for code debugging",
      },
      {
        id: "deepseek-r1:8b",
        name: "DeepSeek R1: 8B",
        description: "DeepSeek's R1 model for code debugging, larger version",
      },
    ],
  },
};
