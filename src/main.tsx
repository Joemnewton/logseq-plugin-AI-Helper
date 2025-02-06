import "@logseq/libs";
import logseq from "@logseq/libs";
import { logseq as PL } from "../package.json";

const pluginId = PL.id;

// Declare Logseq globally to avoid TypeScript errors
declare global {
  interface Window {
    logseq: typeof logseq;
  }
}

// AI Provider interfaces and types
interface AIProvider {
  name: string;
  summarizeText(text: string): Promise<string>;
  improveWriting(text: string): Promise<string>;
  changeWritingStyle(text: string, style: string): Promise<string>;
  completeText(text: string): Promise<string>;
}

interface AIConfig {
  provider: string;
  apiKey: string;
}

// OpenAI Provider Implementation
class OpenAIProvider implements AIProvider {
  private apiKey: string;
  private baseUrl = "https://api.openai.com/v1/chat/completions";
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  name = "OpenAI";

  private async makeRequest(prompt: string): Promise<string> {
    try {
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content.trim();
    } catch (error: any) {
      console.error("OpenAI API error:", error);
      throw new Error(error.message || "Unknown API error");
    }
  }

  async summarizeText(text: string): Promise<string> {
    return this.makeRequest(`Please provide a concise summary of the following text:\n\n${text}`);
  }

  async improveWriting(text: string): Promise<string> {
    return this.makeRequest(`Please improve the following text while maintaining its core message:\n\n${text}`);
  }

  async changeWritingStyle(text: string, style: string): Promise<string> {
    return this.makeRequest(`Please rewrite the following text in a ${style} style:\n\n${text}`);
  }

  async completeText(text: string): Promise<string> {
    return this.makeRequest(`Please complete the following text naturally:\n\n${text}`);
  }
}

// AI Service Manager
class AIManager {
  private provider: AIProvider | null = null;
  private config: AIConfig | null = null;

  async initialize() {
    const config = await (logseq as any)?.settings?.get('aiConfig');
    if (config) {
      this.config = config as AIConfig;
      this.setProvider(this.config.provider, this.config.apiKey);
    }
  }

  setProvider(providerName: string, apiKey: string) {
    switch (providerName.toLowerCase()) {
      case 'openai':
        this.provider = new OpenAIProvider(apiKey);
        break;
      default:
        throw new Error(`Unsupported AI provider: ${providerName}`);
    }
  }

  async executeAICommand(command: string, text: string, style?: string): Promise<string> {
    if (!this.provider) {
      throw new Error('AI provider not configured. Please set up your API key in settings.');
    }

    try {
      switch (command) {
        case 'summarize':
          return await this.provider.summarizeText(text);
        case 'improve':
          return await this.provider.improveWriting(text);
        case 'style':
          return await this.provider.changeWritingStyle(text, style || 'professional');
        case 'complete':
          return await this.provider.completeText(text);
        default:
          throw new Error(`Unknown command: ${command}`);
      }
    } catch (error: any) {
      console.error('AI command execution error:', error);
      throw new Error(error.message || "Unknown AI command error");
    }
  }
}

const aiManager = new AIManager();

// Register settings
function registerSettings() {
  if ((logseq as any)?.useSettingsSchema) {
    (logseq as any).useSettingsSchema([
      {
        key: "aiConfig",
        type: "object",
        default: {
          provider: "openai",
          apiKey: "",
        },
        description: "AI configuration",
        title: "AI Settings",
      },
    ]);
  }
}

// Utility function to handle selected text
async function getSelectedText(): Promise<string> {
  const text = await (logseq as any)?.Editor?.getSelectedText();
  if (!text) {
    throw new Error('No text selected. Please select some text first.');
  }
  return text;
}

// Main plugin initialization
async function main() {
  console.info(`#${pluginId}: MAIN`);
  
  registerSettings();
  await aiManager.initialize();

  // Register AI commands
  const commands = [
    {
      key: "summarize",
      label: "Summarize text",
      action: async () => {
        try {
          const text = await getSelectedText();
          (logseq as any)?.App?.showMsg("Summarizing text...", "info");
          const summary = await aiManager.executeAICommand('summarize', text);
          const block = await (logseq as any)?.Editor?.getCurrentBlock();
          if (block) {
            await (logseq as any)?.Editor?.insertBlock(block.uuid, summary, { after: true });
          }
        } catch (error: any) {
          (logseq as any)?.App?.showMsg(error.message, "error");
        }
      }
    }
  ];

  // Register all commands
  commands.forEach(cmd => {
    (logseq as any)?.Editor?.registerSlashCommand(cmd.label, cmd.action);
  });

  (logseq as any)?.ready(main).catch(console.error);
}