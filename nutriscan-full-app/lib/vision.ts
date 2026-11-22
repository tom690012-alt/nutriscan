import OpenAI from "openai";
import { MAX_SCAN_BYTES, SCAN_IMAGE_TYPES } from "./scan-image";

export async function readScanImage(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof File) || !file.size || !SCAN_IMAGE_TYPES.has(file.type)) {
    return { error: "Please upload a JPG, PNG or WebP photo.", status: 400 } as const;
  }
  if (file.size > MAX_SCAN_BYTES) {
    return { error: "This photo is too large. Please use a photo under 4 MB.", status: 413 } as const;
  }
  return { dataUrl: `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}` };
}

export async function analyzeImage<Result>(
  dataUrl: string, name: string, schema: Record<string, unknown>, instructions: string, prompt: string,
): Promise<Result> {
  const model = process.env.OPENAI_MODEL ?? "gpt-6-luna";
  const completion = await new OpenAI().chat.completions.create({
    model,
    ...(model === "gpt-6-luna" ? { reasoning_effort: "none" as const } : {}),
    response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
    messages: [
      { role: "system", content: instructions },
      { role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: dataUrl } }] },
    ],
  }, { timeout: 35000, maxRetries: 0 });
  const content = completion.choices[0]?.message.content;
  if (!content) throw new Error("Image analysis returned no result.");
  return JSON.parse(content) as Result;
}
