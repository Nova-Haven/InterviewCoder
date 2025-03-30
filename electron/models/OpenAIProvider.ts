import { OpenAI } from "openai";
import { IModelProvider } from "./IModelProvider";

export class OpenAIProvider implements IModelProvider {
  chat = {
    completions: {
      create: async (options: any) => {
        if (!this.client) {
          throw new Error("OpenAI client not initialized");
        }
        return this.client.chat.completions.create(options);
      },
    },
  };

  async debugSolution(
    problemInfo: any,
    imageDataList: string[],
    language: string
  ): Promise<any> {
    if (!this.client) throw new Error("OpenAI client not initialized");

    const solution = Array.isArray(imageDataList)
      ? imageDataList.join("\n")
      : imageDataList;

    const prompt = {
      role: "system" as const,
      content: `You are an expert ${language} debugger. Analyze the provided code solution for the given problem, identify any bugs or inefficiencies, and suggest improvements.`,
    };

    const userMessage = {
      role: "user" as const,
      content: `Problem: ${problemInfo.problem_statement}
Constraints: ${problemInfo.constraints}
Example Input: ${problemInfo.example_input}
Example Output: ${problemInfo.example_output}

Current solution in ${language}:
\`\`\`${language}
${solution}
\`\`\`

Please analyze this code. Identify any bugs, inefficiencies, or edge cases it doesn't handle. Then provide:
1. A brief explanation of any issues found
2. An improved version of the code that fixes these issues
3. Time and space complexity analysis of the improved solution`,
    };

    const response = await this.client.chat.completions.create({
      model: "gpt-4o",
      messages: [prompt, userMessage],
      max_tokens: 4000,
      temperature: 0.2,
    });

    const debugResult = response.choices[0].message.content || "";

    return {
      analysis: debugResult,
      improvedCode: this.extractCodeFromSolution(debugResult, language),
    };
  }
  async generateSolution(problemInfo: any, language: string): Promise<any> {
    if (!this.client) throw new Error("OpenAI client not initialized");

    const prompt = {
      role: "system" as const,
      content: `You are an expert ${language} programmer. Generate a correct and efficient solution for the following problem. Provide thorough explanation of your approach and time/space complexity analysis.`,
    };

    const userMessage = {
      role: "user" as const,
      content: `Problem: ${problemInfo.problem_statement}
Constraints: ${problemInfo.constraints}
Example Input: ${problemInfo.example_input}
Example Output: ${problemInfo.example_output}
Please generate a complete, runnable solution in ${language}. Include comments explaining key parts of your code.`,
    };

    const response = await this.client.chat.completions.create({
      model: "gpt-4o",
      messages: [prompt, userMessage],
      max_tokens: 4000,
      temperature: 0.2,
    });

    const solution = response.choices[0].message.content || "";

    return {
      code: this.extractCodeFromSolution(solution, language),
      explanation: solution,
    };
  }

  private extractCodeFromSolution(solution: string, language: string): string {
    // Extract code blocks marked with ```language ... ```
    const codeBlockRegex = new RegExp(
      `\`\`\`(?:${language})?([\\s\\S]*?)\`\`\``,
      "i"
    );
    const match = solution.match(codeBlockRegex);

    if (match && match[1]) {
      return match[1].trim();
    }

    // If no code block found, return the entire solution
    return solution;
  }
  private client: OpenAI | null = null;

  async initialize(config: any): Promise<boolean> {
    try {
      if (!config.apiKey) return false;

      this.client = new OpenAI({
        apiKey: config.apiKey,
        timeout: 60000,
        maxRetries: 2,
      });
      return true;
    } catch (error) {
      console.error("Failed to initialize OpenAI client:", error);
      return false;
    }
  }

  isInitialized(): boolean {
    return this.client !== null;
  }

  async extractProblemInfo(
    imageDataList: string[],
    language: string
  ): Promise<any> {
    if (!this.client) throw new Error("OpenAI client not initialized");

    const messages = [
      {
        role: "system" as const,
        content:
          "You are a coding challenge interpreter. Analyze the screenshot of the coding problem and extract all relevant information. Return the information in JSON format with these fields: problem_statement, constraints, example_input, example_output. Just return the structured JSON without any other text.",
      },
      {
        role: "user" as const,
        content: [
          {
            type: "text" as const,
            text: `Extract the coding problem details from these screenshots. Return in JSON format. Preferred coding language we gonna use for this problem is ${language}.`,
          },
          ...imageDataList.map((data) => ({
            type: "image_url" as const,
            image_url: { url: `data:image/png;base64,${data}` },
          })),
        ],
      },
    ];

    const response = await this.client.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
      max_tokens: 4000,
      temperature: 0.2,
    });

    const responseText = response.choices[0].message.content || "";
    const jsonText = responseText.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonText);
  }
}
