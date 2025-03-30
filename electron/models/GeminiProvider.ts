import { IModelProvider } from "./IModelProvider";
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

export class GeminiProvider implements IModelProvider {
  private client: GenerativeModel | null = null;
  private genAI: GoogleGenerativeAI | null = null;

  async initialize(config: any): Promise<boolean> {
    try {
      if (!config.geminiApiKey) return false;

      this.genAI = new GoogleGenerativeAI(config.geminiApiKey);

      // Use the specified model or fallback to a default
      const modelName =
        config.geminiModel || config.extractionModel || "gemini-pro-vision";

      console.log(`Initializing Gemini with model: ${modelName}`);

      this.client = this.genAI.getGenerativeModel({
        model: modelName,
      });

      return true;
    } catch (error) {
      console.error("Failed to initialize Gemini client:", error);
      return false;
    }
  }

  isInitialized(): boolean {
    return this.client !== null;
  }

  chat = {
    completions: {
      create: async (options: any) => {
        if (!this.client) {
          throw new Error("Gemini model not initialized");
        }

        try {
          // Extract options that Gemini needs
          const { messages, temperature = 0.7 } = options;

          console.log(
            "Processing messages for Gemini:",
            JSON.stringify(messages.slice(0, 1), null, 2),
            "... and more"
          );

          // Handle different message formats
          const geminiParts: any[] = [];

          // Process each message
          for (const message of messages) {
            if (message.role === "system") {
              // Add system message as text
              geminiParts.push({
                text: `System instruction: ${message.content}`,
              });
              continue;
            }

            // Handle content array (multimodal) or string (text-only)
            if (typeof message.content === "string") {
              geminiParts.push({
                text: message.content,
              });
            } else if (Array.isArray(message.content)) {
              // Process each content item
              for (const item of message.content) {
                if (item.type === "text") {
                  geminiParts.push({
                    text: item.text,
                  });
                } else if (item.type === "image_url") {
                  // Extract base64 data
                  const urlData = item.image_url.url;
                  if (urlData.startsWith("data:image/")) {
                    const base64Data = urlData.split(",")[1];
                    geminiParts.push({
                      inlineData: {
                        data: base64Data,
                        mimeType: "image/png",
                      },
                    });
                  }
                }
              }
            }
          }

          console.log(`Sending ${geminiParts.length} parts to Gemini`);

          // Set generation config
          const generationConfig = {
            temperature: temperature,
            maxOutputTokens: options.max_tokens || 4000,
          };

          // Generate content
          const result = await this.client.generateContent({
            contents: [{ role: "user", parts: geminiParts }],
            generationConfig: generationConfig,
          });

          const response = result.response;
          const text = response.text();

          console.log("Gemini response received, length:", text.length);

          // Return in a format compatible with OpenAI
          return {
            choices: [
              {
                message: {
                  content: text,
                },
              },
            ],
          };
        } catch (error) {
          console.error("Error in Gemini.chat.completions.create:", error);
          throw error;
        }
      },
    },
  };

  // Additional methods that aren't currently being used
  async extractProblemInfo(
    imageDataList: string[],
    language: string
  ): Promise<any> {
    if (!this.client) {
      throw new Error("Gemini client not initialized");
    }

    try {
      const prompt = `Extract and analyze the coding problem from these images. 
            Provide the problem description, requirements, and constraints in JSON format.
            Focus on details relevant for ${language} implementation.`;

      const parts = [
        { text: prompt },
        ...imageDataList.map((data) => ({
          inlineData: {
            data: data.replace(/^data:image\/(png|jpeg|jpg);base64,/, ""),
            mimeType: "image/jpeg",
          },
        })),
      ];

      const result = await this.client.generateContent({
        contents: [{ role: "user", parts }],
      });

      const response = result.response;
      const text = response.text();

      try {
        return JSON.parse(text);
      } catch {
        return { description: text };
      }
    } catch (error) {
      console.error("Error extracting problem info:", error);
      throw new Error("Failed to extract problem information from images");
    }
  }

  async generateSolution(problemInfo: any, language: string): Promise<any> {
    if (!this.client) {
      throw new Error("Gemini client not initialized");
    }

    try {
      const prompt = `Generate a solution for this coding problem:\n${JSON.stringify(
        problemInfo
      )}\n\nUse ${language} programming language.`;

      const result = await this.client.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const response = result.response;
      return response.text();
    } catch (error) {
      console.error("Error generating solution:", error);
      throw new Error("Failed to generate solution");
    }
  }

  async debugSolution(
    problemInfo: any,
    imageDataList: string[],
    language: string
  ): Promise<any> {
    if (!this.client) {
      throw new Error("Gemini client not initialized");
    }

    try {
      const prompt = `Debug the coding problem shown in these images.
                Problem context: ${JSON.stringify(problemInfo)}
                Programming language: ${language}
                Analyze the code, identify bugs, and suggest fixes.
                Provide the response in JSON format with the following structure:
                {
                    "bugs": [list of identified issues],
                    "suggestions": [list of recommended fixes],
                    "explanation": "detailed explanation"
                }`;

      const parts = [
        { text: prompt },
        ...imageDataList.map((data) => ({
          inlineData: {
            data: data.replace(/^data:image\/(png|jpeg|jpg);base64,/, ""),
            mimeType: "image/jpeg",
          },
        })),
      ];

      const result = await this.client.generateContent({
        contents: [{ role: "user", parts }],
      });

      const response = result.response;
      const text = response.text();

      try {
        return JSON.parse(text);
      } catch {
        return { explanation: text };
      }
    } catch (error) {
      console.error("Error debugging solution:", error);
      throw new Error("Failed to debug the solution");
    }
  }
}
