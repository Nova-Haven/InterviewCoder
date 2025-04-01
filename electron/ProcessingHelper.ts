// ProcessingHelper.ts
import fs from "node:fs";
import { ScreenshotHelper } from "./ScreenshotHelper";
import { IProcessingHelperDeps } from "./main";
import * as axios from "axios";
import { BrowserWindow } from "electron";
import { IModelProvider } from "./models/IModelProvider";
import { OpenAIProvider } from "./models/OpenAIProvider";
import { GeminiProvider } from "./models/GeminiProvider";
import { OllamaProvider } from "./models/OllamaProvider";
import { configHelper } from "./ConfigHelper";

export class ProcessingHelper {
  private deps: IProcessingHelperDeps;
  private screenshotHelper: ScreenshotHelper;
  private modelProvider: IModelProvider | null = null;

  // AbortControllers for API requests
  private currentProcessingAbortController: AbortController | null = null;
  private currentExtraProcessingAbortController: AbortController | null = null;

  constructor(deps: IProcessingHelperDeps) {
    this.deps = deps;
    this.screenshotHelper = deps.getScreenshotHelper();

    // Initialize OpenAI client
    this.initializeModelProvider();

    // Listen for config changes to re-initialize the OpenAI client
    configHelper.on("config-updated", () => {
      this.initializeModelProvider();
    });
  }

  /**
   * Initialize or reinitialize the model provider with current config
   */
  private async initializeModelProvider(): Promise<void> {
    try {
      const config = configHelper.loadConfig();
      const providerType = config.modelProvider || "openai";

      // Create the appropriate provider
      switch (providerType) {
        case "gemini":
          this.modelProvider = new GeminiProvider();
          break;
        case "ollama":
          this.modelProvider = new OllamaProvider();
          break;
        case "openai":
        default:
          this.modelProvider = new OpenAIProvider();
          break;
      }

      // Initialize the provider
      const success = await this.modelProvider.initialize(config);
      if (success) {
        console.log(`${providerType} model provider initialized successfully`);
      } else {
        this.modelProvider = null;
        console.warn(`Failed to initialize ${providerType} model provider`);
      }
    } catch (error) {
      console.error("Failed to initialize model provider:", error);
      this.modelProvider = null;
    }
  }

  private async waitForInitialization(
    mainWindow: BrowserWindow
  ): Promise<void> {
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds total

    while (attempts < maxAttempts) {
      const isInitialized = await mainWindow.webContents.executeJavaScript(
        "window.__IS_INITIALIZED__"
      );
      if (isInitialized) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }
    throw new Error("App failed to initialize after 5 seconds");
  }

  private async getLanguage(): Promise<string> {
    try {
      // Get language from config
      const config = configHelper.loadConfig();
      if (config.language) {
        return config.language;
      }

      // Fallback to window variable if config doesn't have language
      const mainWindow = this.deps.getMainWindow();
      if (mainWindow) {
        try {
          await this.waitForInitialization(mainWindow);
          const language = await mainWindow.webContents.executeJavaScript(
            "window.__LANGUAGE__"
          );

          if (
            typeof language === "string" &&
            language !== undefined &&
            language !== null
          ) {
            return language;
          }
        } catch (err) {
          console.warn("Could not get language from window", err);
        }
      }

      // Default fallback
      return "python";
    } catch (error) {
      console.error("Error getting language:", error);
      return "python";
    }
  }

  public async processScreenshots(): Promise<void> {
    const mainWindow = this.deps.getMainWindow();
    if (!mainWindow) return;

    // First verify we have a valid client
    if (!this.modelProvider) {
      this.initializeModelProvider();

      if (!this.modelProvider) {
        console.error("Model provider not initialized");
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.API_KEY_INVALID
        );
        return;
      }
    }

    const view = this.deps.getView();
    console.log("Processing screenshots in view:", view);

    if (view === "queue") {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.INITIAL_START);
      const screenshotQueue = this.screenshotHelper.getScreenshotQueue();
      console.log("Processing main queue screenshots:", screenshotQueue);
      if (screenshotQueue.length === 0) {
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      try {
        // Initialize AbortController
        this.currentProcessingAbortController = new AbortController();
        const { signal } = this.currentProcessingAbortController;

        const screenshots = await Promise.all(
          screenshotQueue.map(async (path) => ({
            path,
            preview: await this.screenshotHelper.getImagePreview(path),
            data: fs.readFileSync(path).toString("base64"),
          }))
        );

        const result = await this.processScreenshotsHelper(screenshots, signal);

        if (!result.success) {
          console.log("Processing failed:", result.error);
          if (
            result.error?.includes("API Key") ||
            result.error?.includes("invalid")
          ) {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.API_KEY_INVALID
            );
          } else {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
              result.error
            );
          }
          // Reset view back to queue on error
          console.log("Resetting view to queue due to error");
          this.deps.setView("queue");
          return;
        }

        // Only set view to solutions if processing succeeded
        console.log("Setting view to solutions after successful processing");
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
          result.data
        );
        this.deps.setView("solutions");
      } catch (error: any) {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
          error
        );
        console.error("Processing error:", error);
        if (axios.isCancel(error)) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            "Processing was canceled by the user."
          );
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            error.message || "Server error. Please try again."
          );
        }
        // Reset view back to queue on error
        console.log("Resetting view to queue due to error");
        this.deps.setView("queue");
      } finally {
        this.currentProcessingAbortController = null;
      }
    } else {
      // view == 'solutions'
      const extraScreenshotQueue =
        this.screenshotHelper.getExtraScreenshotQueue();
      console.log("Processing extra queue screenshots:", extraScreenshotQueue);
      if (extraScreenshotQueue.length === 0) {
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.DEBUG_START);

      // Initialize AbortController
      this.currentExtraProcessingAbortController = new AbortController();
      const { signal } = this.currentExtraProcessingAbortController;

      try {
        const screenshots = await Promise.all(
          [
            ...this.screenshotHelper.getScreenshotQueue(),
            ...extraScreenshotQueue,
          ].map(async (path) => ({
            path,
            preview: await this.screenshotHelper.getImagePreview(path),
            data: fs.readFileSync(path).toString("base64"),
          }))
        );
        console.log(
          "Combined screenshots for processing:",
          screenshots.map((s) => s.path)
        );

        const result = await this.processExtraScreenshotsHelper(
          screenshots,
          signal
        );

        if (result.success) {
          this.deps.setHasDebugged(true);
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_SUCCESS,
            result.data
          );
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            result.error
          );
        }
      } catch (error: any) {
        if (axios.isCancel(error)) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            "Extra processing was canceled by the user."
          );
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            error.message
          );
        }
      } finally {
        this.currentExtraProcessingAbortController = null;
      }
    }
  }

  private async processScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal: AbortSignal
  ) {
    try {
      // Check if provider is initialized
      if (!this.modelProvider || !this.modelProvider.isInitialized()) {
        await this.initializeModelProvider();

        if (!this.modelProvider || !this.modelProvider.isInitialized()) {
          return {
            success: false,
            error:
              "Model provider not initialized or API key invalid. Please check your settings.",
          };
        }
      }

      const config = configHelper.loadConfig();
      const language = await this.getLanguage();
      const mainWindow = this.deps.getMainWindow();

      // Step 1: Extract problem info using the extraction model
      const imageDataList = screenshots.map((screenshot) => screenshot.data);

      // Update the user on progress
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Analyzing problem from screenshots...",
          progress: 20,
        });
      }

      const messages = [
        {
          role: "system" as const,
          content:
            config.modelProvider === "ollama"
              ? "You are a coding challenge interpreter. Your task is to analyze screenshots of a coding problem and extract ALL the information. Return ONLY a SINGLE JSON object with these fields: problem_statement, constraints (as array), example_input, example_output. Do not include multiple possibilities or variations. ONLY return a valid JSON object."
              : "You are a coding challenge interpreter. Analyze the screenshot of the coding problem and extract all relevant information. Return the information in JSON format with these fields: problem_statement, constraints, example_input, example_output. Just return the structured JSON without any other text.",
        },
        {
          role: "user" as const,
          content: [
            {
              type: "text" as const,
              text: `Extract the coding problem details from these screenshots. Return in JSON format. Preferred coding language we gonna use for this problem is ${language}.${
                config.modelProvider === "ollama"
                  ? " IMPORTANT: Return ONLY a single valid JSON object, not an array of possibilities."
                  : ""
              }`,
            },
            ...imageDataList.map((data) => ({
              type: "image_url" as const,
              image_url: { url: `data:image/png;base64,${data}` },
            })),
          ],
        },
      ];

      // Send to LLM provider's API
      const extractionResponse =
        await this.modelProvider.chat.completions.create({
          model: config.extractionModel,
          messages: messages,
          max_tokens: 4000,
          temperature: 0.2,
        });

      // Parse the response to get structured problem info
      let problemInfo;
      try {
        const responseText = extractionResponse.choices[0].message.content;
        console.log("Raw model response:", responseText);

        // Clean up the response: handle malformed JSON arrays, markdown code blocks, etc.
        let jsonText = responseText
          .replace(/```json|```/g, "") // Remove markdown code blocks
          .trim();

        // If it starts with [ and doesn't end with ], add the closing bracket
        if (jsonText.startsWith("[") && !jsonText.endsWith("]")) {
          jsonText += "]";
        }

        // If it contains multiple JSON objects but isn't a proper array
        if (jsonText.includes("}{")) {
          jsonText = "[" + jsonText.replace(/}{/g, "},{") + "]";
        }

        // Try to parse the JSON
        try {
          problemInfo = JSON.parse(jsonText);

          // If we got an array of problems, pick the first complete one
          if (Array.isArray(problemInfo)) {
            console.log(
              `Received ${problemInfo.length} problem interpretations, selecting most complete one`
            );

            // Find the most complete problem description
            const completeProblem = problemInfo.find(
              (p) =>
                p.problem_statement &&
                ((p.constraints && p.constraints.length > 0) ||
                  (p.example_input && p.example_output))
            );

            // If found a complete one, use it, otherwise use the first one
            problemInfo = completeProblem || problemInfo[0];
            console.log("Selected problem:", problemInfo);
          }
        } catch (jsonError) {
          console.error("Failed to parse the JSON:", jsonError);

          // If that failed, try a different approach:
          // Extract the relevant information using regex
          const problemMatch = responseText.match(
            /"problem_statement"\s*:\s*"([^"]+)"/
          );
          const constraintsMatch = responseText.match(
            /"constraints"\s*:\s*\[(.*?)\]/
          );
          const inputMatch = responseText.match(
            /"example_input"\s*:\s*"([^"]+)"/
          );
          const outputMatch = responseText.match(
            /"example_output"\s*:\s*"([^"]+)"/
          );

          if (problemMatch) {
            problemInfo = {
              problem_statement: problemMatch[1],
              constraints: constraintsMatch
                ? constraintsMatch[1]
                    .split(",")
                    .map((s) => s.trim().replace(/"/g, ""))
                : [],
              example_input: inputMatch ? inputMatch[1] : "",
              example_output: outputMatch ? outputMatch[1] : "",
            };
            console.log("Extracted problem info via regex:", problemInfo);
          } else {
            throw new Error("Could not extract valid problem information");
          }
        }

        // Update the user on progress
        if (mainWindow) {
          mainWindow.webContents.send("processing-status", {
            message:
              "Problem analyzed successfully. Preparing to generate solution...",
            progress: 40,
          });
        }
      } catch (error) {
        console.error("Error parsing problem extraction response:", error);
        console.log(
          "Raw response:",
          extractionResponse.choices[0].message.content
        );

        // Try one last approach: extract what looks like a problem statement
        const rawResponse = extractionResponse.choices[0].message.content;
        if (
          rawResponse.toLowerCase().includes("problem") &&
          rawResponse.includes(":")
        ) {
          try {
            // Create a minimal valid problem object from whatever text we have
            const lines = rawResponse
              .split("\n")
              .filter((line) => line.trim().length > 0);
            const problemLine = lines.find(
              (line) =>
                line.toLowerCase().includes("problem") && line.includes(":")
            );

            if (problemLine) {
              const problemStatement = problemLine
                .split(":")
                .slice(1)
                .join(":")
                .trim();
              problemInfo = {
                problem_statement: problemStatement,
                constraints: [],
                example_input: "",
                example_output: "",
              };

              console.log("Created minimal problem object:", problemInfo);

              // Update the user on progress
              if (mainWindow) {
                mainWindow.webContents.send("processing-status", {
                  message:
                    "Problem analyzed with limited information. Proceeding...",
                  progress: 35,
                });
              }

              // Store problem info in AppState and continue
              this.deps.setProblemInfo(problemInfo);

              // Send first success event
              if (mainWindow) {
                mainWindow.webContents.send(
                  this.deps.PROCESSING_EVENTS.PROBLEM_EXTRACTED,
                  problemInfo
                );

                // Generate solutions after extraction
                const solutionsResult = await this.generateSolutionsHelper(
                  signal
                );
                if (solutionsResult.success) {
                  // Clear any existing extra screenshots
                  this.screenshotHelper.clearExtraScreenshotQueue();

                  // Final progress update
                  mainWindow.webContents.send("processing-status", {
                    message: "Solution generated successfully",
                    progress: 100,
                  });

                  mainWindow.webContents.send(
                    this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
                    solutionsResult.data
                  );
                  return { success: true, data: solutionsResult.data };
                }
              }
            }
          } catch (fallbackError) {
            console.error("Failed even with fallback parsing:", fallbackError);
          }
        }

        return {
          success: false,
          error:
            "Failed to parse problem information. Please try again or use clearer screenshots.",
        };
      }

      // Store problem info in AppState
      this.deps.setProblemInfo(problemInfo);

      // Send first success event
      if (mainWindow) {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.PROBLEM_EXTRACTED,
          problemInfo
        );

        // Generate solutions after successful extraction
        const solutionsResult = await this.generateSolutionsHelper(signal);
        if (solutionsResult.success) {
          // Clear any existing extra screenshots before transitioning to solutions view
          this.screenshotHelper.clearExtraScreenshotQueue();

          // Final progress update
          mainWindow.webContents.send("processing-status", {
            message: "Solution generated successfully",
            progress: 100,
          });

          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
            solutionsResult.data
          );
          return { success: true, data: solutionsResult.data };
        } else {
          throw new Error(
            solutionsResult.error || "Failed to generate solutions"
          );
        }
      }

      return { success: false, error: "Failed to process screenshots" };
    } catch (error: any) {
      // If the request was cancelled, don't retry
      if (axios.isCancel(error)) {
        return {
          success: false,
          error: "Processing was canceled by the user.",
        };
      }

      // Handle API errors generically
      if (error?.response?.status === 401) {
        return {
          success: false,
          error: "Invalid API key. Please check your settings.",
        };
      } else if (error?.response?.status === 429) {
        return {
          success: false,
          error:
            "API rate limit exceeded or insufficient credits. Please try again later.",
        };
      } else if (error?.response?.status === 500) {
        return {
          success: false,
          error: "Server error. Please try again later.",
        };
      }

      console.error("API Error Details:", error);
      return {
        success: false,
        error:
          error.message || "Failed to process screenshots. Please try again.",
      };
    }
  }

  private async generateSolutionsHelper(signal: AbortSignal) {
    try {
      const problemInfo = this.deps.getProblemInfo();
      const language = await this.getLanguage();
      const config = configHelper.loadConfig();
      const mainWindow = this.deps.getMainWindow();

      if (!problemInfo) {
        throw new Error("No problem info available");
      }

      if (!this.modelProvider) {
        return {
          success: false,
          error: "API key not configured. Please check your settings.",
        };
      }

      // Update progress status
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Creating optimal solution with detailed explanations...",
          progress: 60,
        });
      }

      // Create prompt for solution generation
      const promptText = `
Generate a detailed solution for the following coding problem:

PROBLEM STATEMENT:
${problemInfo.problem_statement}

CONSTRAINTS:
${problemInfo.constraints || "No specific constraints provided."}

EXAMPLE INPUT:
${problemInfo.example_input || "No example input provided."}

EXAMPLE OUTPUT:
${problemInfo.example_output || "No example output provided."}

LANGUAGE: ${language}

I need the response in the following format:
1. Code: A clean, optimized implementation in ${language}
2. Your Thoughts: A list of key insights and reasoning behind your approach
3. Time complexity: O(X) with a detailed explanation (at least 2 sentences)
4. Space complexity: O(X) with a detailed explanation (at least 2 sentences)

For complexity explanations, please be thorough. For example: "Time complexity: O(n) because we iterate through the array only once. This is optimal as we need to examine each element at least once to find the solution." or "Space complexity: O(n) because in the worst case, we store all elements in the hashmap. The additional space scales linearly with the input size."

Your solution should be efficient, well-commented, and handle edge cases.
`;

      // Send to OpenAI API
      const solutionResponse = await this.modelProvider.chat.completions.create(
        {
          model: config.solutionModel || "gpt-4o", // Using selected model for code generation
          messages: [
            {
              role: "system",
              content:
                "You are an expert coding interview assistant. Provide clear, optimal solutions with detailed explanations.",
            },
            { role: "user", content: promptText },
          ],
          max_tokens: 4000,
          temperature: 0.2,
        }
      );

      const responseContent = solutionResponse.choices[0].message.content;

      // Extract parts from the response
      const codeMatch = responseContent.match(/```(?:\w+)?\s*([\s\S]*?)```/);
      const code = codeMatch ? codeMatch[1].trim() : responseContent;

      // Extract thoughts, looking for bullet points or numbered lists
      const thoughtsRegex =
        /(?:Thoughts:|Key Insights:|Reasoning:|Approach:)([\s\S]*?)(?:Time complexity:|$)/i;
      const thoughtsMatch = responseContent.match(thoughtsRegex);
      let thoughts: string[] = [];

      if (thoughtsMatch && thoughtsMatch[1]) {
        // Extract bullet points or numbered items
        const bulletPoints = thoughtsMatch[1].match(
          /(?:^|\n)\s*(?:[-*•]|\d+\.)\s*(.*)/g
        );
        if (bulletPoints) {
          thoughts = bulletPoints
            .map((point: string) =>
              point.replace(/^\s*(?:[-*•]|\d+\.)\s*/, "").trim()
            )
            .filter(Boolean);
        } else {
          // If no bullet points found, split by newlines and filter empty lines
          thoughts = thoughtsMatch[1]
            .split("\n")
            .map((line: string) => line.trim())
            .filter(Boolean);
        }
      }

      // Extract complexity information
      // Use more flexible patterns to find complexity sections
      const timeComplexityPattern =
        /Time complexity:?\s*([^\n]+(?:\n[^\n]+)*?)(?=\n\s*(?:Space complexity|$))/i;
      const spaceComplexityPattern =
        /Space complexity:?\s*([^\n]+(?:\n[^\n]+)*?)(?=\n\s*(?:[A-Z]|$))/i;

      let timeComplexity =
        "O(n) - Linear time complexity because we only iterate through the array once. Each element is processed exactly one time, and the hashmap lookups are O(1) operations.";
      let spaceComplexity =
        "O(n) - Linear space complexity because we store elements in the hashmap. In the worst case, we might need to store all elements before finding the solution pair.";

      // Extract time complexity with better matching
      const timeMatch = responseContent.match(timeComplexityPattern);
      if (timeMatch && timeMatch[1]) {
        timeComplexity = timeMatch[1].trim();
        // Ensure the response includes actual Big O notation and a dash
        if (!timeComplexity.match(/O\([^)]+\)/i)) {
          timeComplexity = `O(n) - ${timeComplexity}`;
        } else if (
          !timeComplexity.includes("-") &&
          !timeComplexity.includes("because")
        ) {
          // Add a dash if there isn't one and no 'because'
          const notationMatch = timeComplexity.match(/O\([^)]+\)/i);
          if (notationMatch) {
            const notation = notationMatch[0];
            const rest = timeComplexity.replace(notation, "").trim();
            timeComplexity = `${notation} - ${rest}`;
          }
        }
      }

      // Extract space complexity with better matching
      const spaceMatch = responseContent.match(spaceComplexityPattern);
      if (spaceMatch && spaceMatch[1]) {
        spaceComplexity = spaceMatch[1].trim();
        // Ensure the response includes actual Big O notation and a dash
        if (!spaceComplexity.match(/O\([^)]+\)/i)) {
          spaceComplexity = `O(n) - ${spaceComplexity}`;
        } else if (
          !spaceComplexity.includes("-") &&
          !spaceComplexity.includes("because")
        ) {
          // Add a dash if there isn't one and no 'because'
          const notationMatch = spaceComplexity.match(/O\([^)]+\)/i);
          if (notationMatch) {
            const notation = notationMatch[0];
            const rest = spaceComplexity.replace(notation, "").trim();
            spaceComplexity = `${notation} - ${rest}`;
          }
        }
      }

      // Construct the formatted response
      const formattedResponse = {
        code: code,
        thoughts:
          thoughts.length > 0
            ? thoughts
            : ["Solution approach based on efficiency and readability"],
        time_complexity: timeComplexity,
        space_complexity: spaceComplexity,
      };

      return { success: true, data: formattedResponse };
    } catch (error: any) {
      // Handle API errors generically
      if (error?.response?.status === 401) {
        return {
          success: false,
          error: "Invalid API key. Please check your settings.",
        };
      } else if (error?.response?.status === 429) {
        return {
          success: false,
          error:
            "API rate limit exceeded or insufficient credits. Please try again later.",
        };
      }

      console.error("Solution generation error:", error);
      return {
        success: false,
        error: error.message || "Failed to generate solution",
      };
    }
  }

  private async processExtraScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal: AbortSignal
  ) {
    try {
      const problemInfo = this.deps.getProblemInfo();
      const language = await this.getLanguage();
      const config = configHelper.loadConfig();
      const mainWindow = this.deps.getMainWindow();

      if (!problemInfo) {
        throw new Error("No problem info available");
      }

      if (!this.modelProvider) {
        return {
          success: false,
          error: "API key not configured. Please check your settings.",
        };
      }

      // Update progress status
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Processing debug screenshots...",
          progress: 30,
        });
      }

      // Prepare the images for the API call
      const imageDataList = screenshots.map((screenshot) => screenshot.data);

      // Improved prompt with even clearer instructions
      const messages = [
        {
          role: "system" as const,
          content: `You are a coding interview assistant helping debug solutions. 
  
  IMPORTANT: ONLY analyze code visible in the screenshots. Don't assume code not shown.
  
  Format your response EXACTLY in these sections:
  
  ----- ISSUES IDENTIFIED -----
  • List actual issues you see in the code (not theoretical issues)
  • If no issues are found, explicitly state "No issues found in the visible code"
  
  ----- CODE CHANGES -----
  This section MUST ONLY contain runnable code that should be changed.
  If no changes are needed, write ONLY: "No code changes required."
  DO NOT include explanations or comments in this section - ONLY code.
  
  ----- EXPLANATION -----
  Explain why the changes are needed based on the visible code.
  If no changes are needed, explain why the code is already correct.
  
  ----- KEY POINTS -----
  • Summary of most important takeaways
  
  The CODE CHANGES section must ONLY contain actual code that can be directly pasted into an editor.`,
        },
        {
          role: "user" as const,
          content: [
            {
              type: "text" as const,
              text: `I'm solving this coding problem: "${problemInfo.problem_statement}" in ${language}.
  
  I need help debugging ONLY the code visible in these screenshots:
  1. Don't make assumptions about code you can't see
  2. If my code already looks correct, just say so
  3. Be specific about line numbers when possible
  4. In the CODE CHANGES section, ONLY include actual code that should be changed
  5. NEVER invent code that isn't in the screenshots
  
  Please follow the format exactly and focus on REAL problems, not theoretical ones.`,
            },
            ...imageDataList.map((data) => ({
              type: "image_url" as const,
              image_url: { url: `data:image/png;base64,${data}` },
            })),
          ],
        },
      ];

      // Update progress
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Analyzing code and generating debug feedback...",
          progress: 60,
        });
      }

      // Send to provider API
      const debugResponse = await this.modelProvider.chat.completions.create({
        model: config.debuggingModel || "gpt-4o",
        messages: messages,
        max_tokens: 4000,
        temperature: 0.2,
      });

      // Update final progress
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Debug analysis complete",
          progress: 100,
        });
      }

      // Extract and format the debug response
      const debugContent = debugResponse.choices[0].message.content;

      // Strip all markdown formatting to ensure clean output
      const cleanContent = debugContent
        .replace(/```[\s\S]*?```/g, (match) => {
          // For code blocks, keep the content but remove the backticks
          return match.replace(/```(?:\w+)?\n?|\n?```/g, "");
        })
        .replace(/\*\*(.*?)\*\*/g, "$1") // Remove bold formatting
        .replace(/\*(.*?)\*/g, "$1") // Remove italic formatting
        .replace(/\[(.*?)\]\((.*?)\)/g, "$1 ($2)") // Convert links to plain text
        .replace(/#+\s+(.*?)\n/g, "$1:\n") // Convert headers to plain text with colon
        .replace(/^\s*[-*]\s+/gm, "• "); // Standardize bullet points

      // Format the sections
      const sections = {
        issues: "",
        codeChanges: "",
        explanation: "",
        keyPoints: "",
      };

      // Extract sections using plain text markers
      if (cleanContent.includes("----- ISSUES IDENTIFIED -----")) {
        const parts = cleanContent.split(/-----.*?-----/);
        if (parts.length >= 4) {
          sections.issues = parts[1].trim();
          sections.codeChanges = parts[2].trim();
          sections.explanation = parts[3].trim();

          // Key points might be in part 4 if it exists
          if (parts.length >= 5) {
            sections.keyPoints = parts[4].trim();
          }
        }
      } else {
        // Fallback: try to identify sections by keywords
        const content = cleanContent;

        const issuesMatch = content.match(
          /(?:Issues identified|Problems found):([\s\S]*?)(?:Code changes|Code improvements|Explanation|$)/i
        );
        if (issuesMatch) sections.issues = issuesMatch[1].trim();

        const codeMatch = content.match(
          /(?:Code changes|Code improvements|Suggested changes|Fixes):([\s\S]*?)(?:Explanation|Key points|$)/i
        );
        if (codeMatch) sections.codeChanges = codeMatch[1].trim();

        const explanationMatch = content.match(
          /(?:Explanation|Reasoning|Analysis):([\s\S]*?)(?:Key points|$)/i
        );
        if (explanationMatch) sections.explanation = explanationMatch[1].trim();

        const keyPointsMatch = content.match(
          /(?:Key points|Summary|Takeaways):([\s\S]*?)$/i
        );
        if (keyPointsMatch) sections.keyPoints = keyPointsMatch[1].trim();
      }

      // Detect if no issues were found
      const noIssuesFound =
        sections.issues.toLowerCase().includes("no issues") ||
        sections.issues.toLowerCase().includes("code looks correct") ||
        sections.issues.toLowerCase().includes("not found") ||
        sections.codeChanges.toLowerCase().includes("no code changes") ||
        !sections.issues.trim();

      // Special handling for code
      let codeChanges = "";

      if (noIssuesFound) {
        codeChanges = "__NO_CODE_CHANGES_NEEDED__"; // Special marker for frontend
      } else {
        // If there are code changes, clean up the section to only include actual code
        if (
          sections.codeChanges &&
          !sections.codeChanges.toLowerCase().includes("no code changes")
        ) {
          // Remove any explanatory text that might be mixed with the code
          const codeLines = sections.codeChanges
            .split("\n")
            .filter(
              (line) =>
                !line.toLowerCase().includes("should be") &&
                !line.toLowerCase().includes("recommend") &&
                !line.toLowerCase().includes("would change") &&
                !line.toLowerCase().includes("here's") &&
                !line.toLowerCase().startsWith("•") &&
                line.trim() !== ""
            );

          codeChanges = codeLines.join("\n");

          // If we've filtered everything out, provide a fallback
          if (!codeChanges.trim()) {
            codeChanges = "__ANALYSIS_ONLY__"; // Special marker for frontend
          }
        } else {
          codeChanges = "__ANALYSIS_ONLY__"; // Special marker for frontend
        }
      }

      // Format the analysis without duplicating issue info
      const formattedAnalysis =
        "ISSUES IDENTIFIED:\n" +
        (sections.issues ||
          "No specific issues identified in the visible code") +
        "\n\n" +
        "EXPLANATION:\n" +
        (sections.explanation || "No additional explanation provided") +
        "\n\n" +
        "KEY POINTS:\n" +
        (sections.keyPoints ||
          "• Review the suggested changes carefully\n• Test the solution after making changes");

      // Extract thoughts bullet points
      const thoughtsLines = cleanContent.match(/(?:^|\n)\s*•\s*(.*?)(?:\n|$)/g);
      const thoughts = thoughtsLines
        ? thoughtsLines
            .map((line) => line.replace(/\s*•\s*/, "").trim())
            .filter(Boolean)
            .filter((t) => t.length >= 5) // Only include meaningful thoughts
            .slice(0, 5)
        : ["Review the analysis to improve your solution"];

      // Create a more structured response that avoids duplication
      // and clearly communicates to the frontend when no changes are needed
      const response = {
        code: codeChanges, // Special markers for frontend processing
        debug_analysis: formattedAnalysis, // Full analysis for the analysis section
        thoughts: thoughts, // Bullet points for quick reference
        time_complexity: "N/A - Debug mode",
        space_complexity: "N/A - Debug mode",
        status: noIssuesFound ? "NO_CHANGES" : "HAS_CHANGES", // Explicit status flag
      };

      return { success: true, data: response };
    } catch (error: any) {
      // Error handling remains the same
      if (error?.response?.status === 401) {
        return {
          success: false,
          error: "Invalid API key. Please check your settings.",
        };
      } else if (error?.response?.status === 429) {
        return {
          success: false,
          error:
            "API rate limit exceeded or insufficient credits. Please try again later.",
        };
      }

      console.error("Debug processing error:", error);
      return {
        success: false,
        error: error.message || "Failed to process debug request",
      };
    }
  }

  public cancelOngoingRequests(): void {
    let wasCancelled = false;

    if (this.currentProcessingAbortController) {
      this.currentProcessingAbortController.abort();
      this.currentProcessingAbortController = null;
      wasCancelled = true;
    }

    if (this.currentExtraProcessingAbortController) {
      this.currentExtraProcessingAbortController.abort();
      this.currentExtraProcessingAbortController = null;
      wasCancelled = true;
    }

    // Reset hasDebugged flag
    this.deps.setHasDebugged(false);

    // Clear any pending state
    this.deps.setProblemInfo(null);

    const mainWindow = this.deps.getMainWindow();
    if (wasCancelled && mainWindow && !mainWindow.isDestroyed()) {
      // Send a clear message that processing was cancelled
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
    }
  }
}
