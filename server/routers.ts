import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { analyzeCSV } from "./csvAnalyzer";

async function callGrok(messages: { role: string; content: string }[], apiKey: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Grok API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "No response from Grok.";
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  analysis: router({
    uploadAndAnalyze: publicProcedure
      .input(z.object({
        fileName: z.string(),
        csvContent: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          return analyzeCSV(input.csvContent);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          throw new Error(`Analysis failed: ${message}`);
        }
      }),

    getHistory: publicProcedure.query(async () => []),
  }),

  ai: router({
    chat: publicProcedure
      .input(z.object({
        messages: z.array(z.object({
          role: z.enum(["system", "user", "assistant"]),
          content: z.string(),
        })),
        apiKey: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const apiKey = input.apiKey || process.env.GROK_API_KEY || "";
        if (!apiKey) throw new Error("No Grok API key provided. Add it in the chat or set GROK_API_KEY in your .env file.");
        const reply = await callGrok(input.messages, apiKey);
        return { reply };
      }),
  }),
});

export type AppRouter = typeof appRouter;
