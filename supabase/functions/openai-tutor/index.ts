import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface RequestBody {
  messages: ChatMessage[];
  robotId?: string;
  systemPrompt?: string;
  model?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    const { messages, robotId, systemPrompt, model = "gpt-4o" }: RequestBody = await req.json();
    console.log(`Processing chat request - Robot: ${robotId}, Model: ${model}, Messages: ${messages.length}`);
    console.log(`System prompt received: ${systemPrompt ? `${systemPrompt.length} chars` : "NONE"}`);
    
    // Log first 500 chars of system prompt for debugging
    if (systemPrompt) {
      console.log(`System prompt preview: ${systemPrompt.substring(0, 500)}...`);
    }

    // Build messages array with system prompt
    let finalMessages: ChatMessage[] = [];
    
    if (systemPrompt) {
      finalMessages.push({ role: "system", content: systemPrompt });
    }

    // Add conversation messages (limit to last 10 for context window)
    const recentMessages = messages.slice(-10);
    finalMessages = [...finalMessages, ...recentMessages];

    console.log(`Sending ${finalMessages.length} messages to OpenAI (system prompt: ${systemPrompt ? 'YES' : 'NO'})`);

    // Make streaming request to OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: finalMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error: ${response.status} - ${errorText}`);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to get response from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Track tokens for this request (approximate)
    let inputTokens = 0;
    let outputTokens = 0;

    // Estimate input tokens (rough approximation)
    for (const msg of finalMessages) {
      inputTokens += Math.ceil(msg.content.length / 4);
    }

    // Create a transform stream to track output tokens
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk);
        // Approximate token count from chunk size
        outputTokens += Math.ceil(chunk.length / 16);
      },
      async flush() {
        // Save token usage after stream completes
        if (userId && robotId) {
          try {
            await supabase.from("token_usage").insert({
              user_id: userId,
              robot_id: robotId,
              input_tokens: inputTokens,
              output_tokens: outputTokens,
              model,
            });
            console.log(`Saved token usage - Input: ${inputTokens}, Output: ${outputTokens}`);
          } catch (error) {
            console.error("Error saving token usage:", error);
          }
        }
      },
    });

    // Pipe the response through our transform stream
    const stream = response.body?.pipeThrough(transformStream);

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (error) {
    console.error("Error in openai-tutor:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
