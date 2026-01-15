import { NextResponse } from "next/server";
import { proxyLLMCall } from "@/lib/llm/proxy";
import { checkBudget, recordUsage } from "@/lib/llm/budget";
import { getBYOKKey } from "@/lib/keys/manager";
import type { LLMRequest } from "@/lib/llm/providers/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { provider, model, messages, temperature, max_tokens, session_id, use_shared } = body;

    if (!provider || !model || !messages) {
      return NextResponse.json(
        { error: "Missing required parameters: provider, model, messages" },
        { status: 400 }
      );
    }

    // Determine API key
    let apiKey: string | null = null;

    if (use_shared && provider === "openai") {
      // Check shared budget
      const budgetCheck = checkBudget();
      if (!budgetCheck.allowed) {
        return NextResponse.json(
          { error: budgetCheck.error || "Shared budget exceeded", code: "SHARED_BUDGET_EXCEEDED" },
          { status: 402 }
        );
      }

      apiKey = process.env.OPENAI_SHARED_API_KEY || null;
      if (!apiKey) {
        return NextResponse.json(
          { error: "Shared OpenAI API key not configured" },
          { status: 500 }
        );
      }
    } else {
      // Use BYOK
      if (!session_id) {
        return NextResponse.json(
          { error: "session_id required for BYOK" },
          { status: 400 }
        );
      }

      apiKey = getBYOKKey(provider as any, session_id);
      if (!apiKey) {
        return NextResponse.json(
          { error: `No API key found for provider ${provider}` },
          { status: 401 }
        );
      }
    }

    // Make LLM call
    const llmRequest: LLMRequest = {
      provider: provider as any,
      model,
      messages,
      temperature,
      max_tokens,
    };

    const response = await proxyLLMCall(llmRequest, apiKey);

    // Record usage if using shared key
    if (use_shared && provider === "openai") {
      recordUsage(model, response.usage.input_tokens, response.usage.output_tokens, "open");
    }

    return NextResponse.json({
      text: response.text,
      usage: response.usage,
      provider_metadata: response.provider_metadata,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "LLM call failed" },
      { status: 500 }
    );
  }
}






