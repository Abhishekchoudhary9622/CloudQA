import { GoogleGenAI } from '@google/genai';
import { AppConfig } from '../config/environment';
import { TestPlan, validateTestPlan } from '../validation/testPlanSchema';
import { HeuristicPlanner } from './heuristicPlanner';

export interface ITestPlanner {
  plan(baseUrl: string, testDescription: string): Promise<TestPlan>;
}

export class AiPlanner implements ITestPlanner {
  constructor(private config: AppConfig) {}

  public async plan(baseUrl: string, testDescription: string): Promise<TestPlan> {
    console.log(`[AI Planner] Generating plan for URL: '${baseUrl}' | Description: '${testDescription}' | Provider: '${this.config.llmProvider}'`);

    if (this.config.llmProvider === 'gemini' && this.config.geminiApiKey) {
      try {
        return await this.planWithGemini(baseUrl, testDescription);
      } catch (err: any) {
        console.warn(`[AI Planner] Gemini planning failed (${err.message}). Falling back to intelligent heuristic planner.`);
      }
    } else if (this.config.llmProvider === 'openai' && this.config.openaiApiKey) {
      try {
        return await this.planWithOpenAi(baseUrl, testDescription);
      } catch (err: any) {
        console.warn(`[AI Planner] OpenAI planning failed (${err.message}). Falling back to intelligent heuristic planner.`);
      }
    }

    // Default or fallback: Intelligent Generic NLP Heuristic Planner
    const heuristicPlan = HeuristicPlanner.plan(baseUrl, testDescription);
    const validation = validateTestPlan(heuristicPlan);
    if (!validation.success) {
      throw new Error(`Heuristic plan validation failed: ${validation.errors.join(', ')}`);
    }
    return validation.data;
  }

  private getSystemPrompt(baseUrl: string, testDescription: string): string {
    return `
You are an expert browser automation engineer. Convert the user's natural language test case into a strictly formatted JSON test plan for Playwright.
Never execute arbitrary JavaScript. Use semantic locators (getByRole, getByLabel, getByPlaceholder, getByText) wherever possible.

Supported Actions:
- navigate: { "action": "navigate", "url": string }
- click: { "action": "click", "target": LocatorTarget, "timeout"?: number }
- fill: { "action": "fill", "target": LocatorTarget, "value": string, "timeout"?: number }
- select: { "action": "select", "target": LocatorTarget, "value": string, "timeout"?: number }
- check: { "action": "check", "target": LocatorTarget }
- uncheck: { "action": "uncheck", "target": LocatorTarget }
- press: { "action": "press", "target": LocatorTarget, "key": string }
- wait_for: { "action": "wait_for", "timeout"?: number, "state"?: "visible"|"hidden" }
- assert_visible: { "action": "assert_visible", "target": LocatorTarget }
- assert_text: { "action": "assert_text", "target": LocatorTarget, "expectedText": string, "exact"?: boolean }
- assert_url: { "action": "assert_url", "url"?: string, "contains"?: string }
- extract: { "action": "extract", "target"?: LocatorTarget, "source"?: "text"|"attribute"|"url", "attributeName"?: string, "variableName": string }

LocatorTarget specification:
{
  "role"?: "button"|"link"|"textbox"|"combobox"|"radio"|"checkbox"|"heading"|"tab"|"alert"|"searchbox"|"option",
  "name"?: string,
  "label"?: string,
  "placeholder"?: string,
  "text"?: string,
  "fallbackSelector"?: string
}

Runtime Variables:
You can use runtime variables like "$variableName" in "value" or "url" for subsequent steps after an "extract" action.

Return ONLY valid JSON matching this schema:
{
  "baseUrl": "${baseUrl}",
  "testDescription": "${testDescription}",
  "steps": [ ... ]
}
`;
  }

  private async planWithGemini(baseUrl: string, testDescription: string): Promise<TestPlan> {
    const ai = new GoogleGenAI({ apiKey: this.config.geminiApiKey! });
    const systemPrompt = this.getSystemPrompt(baseUrl, testDescription);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\nTarget URL: ${baseUrl}\nTest Description: ${testDescription}` }] }
      ]
    });

    const responseText = response.text || '';
    const cleanJson = this.extractJson(responseText);
    const parsed = JSON.parse(cleanJson);

    const validation = validateTestPlan(parsed);
    if (!validation.success) {
      throw new Error(`AI generated invalid test plan: ${validation.errors.join('; ')}`);
    }

    return validation.data;
  }

  private async planWithOpenAi(baseUrl: string, testDescription: string): Promise<TestPlan> {
    const systemPrompt = this.getSystemPrompt(baseUrl, testDescription);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Target URL: ${baseUrl}\nTest Description: ${testDescription}\n\nGenerate the complete JSON test plan.`
          }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`OpenAI API returned status ${response.status}: ${errBody}`);
    }

    const data: any = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    const validation = validateTestPlan(parsed);
    if (!validation.success) {
      throw new Error(`OpenAI generated invalid test plan: ${validation.errors.join('; ')}`);
    }

    return validation.data;
  }

  private extractJson(text: string): string {
    const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      return jsonBlockMatch[1].trim();
    }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return text.substring(firstBrace, lastBrace + 1);
    }
    return text.trim();
  }
}
