// Background service worker
// Handles Ollama API calls and side panel opening

chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ASK_OLLAMA") {
    askOllama(message.prompt, message.images, message.responseImages, message.feedback)
      .then((result) => sendResponse({ success: true, result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function askOllama(prompt, imageDescriptions, responseImages = [], feedback = "") {
  const model = "qwen2.5vl:3b";

  const system = `You are an image preference labeling assistant.

CRITICAL RULES:
- You MUST always choose between Image 1 and Image 2.
- You are not allowed to refuse, say "I cannot", "neither", or avoid choosing.
- Even if the difference is small, pick one and explain why.
- Only choose both in the rare case they are truly equal.
- The two Response images are attached. Look at them carefully.
- Source images are only for context.
- Start your answer with "Image 1" or "Image 2" (or "Both"), then explain.
- Do not tell the user to submit.
- If the user gives feedback or a correction, carefully reconsider and adjust your answer.`;

  let userText = `PROMPT:\n${prompt}\n\n${imageDescriptions || ""}\n\nLook at the two attached Response images. Which is better — Image 1 or Image 2 — and why? You must choose.`;

  if (feedback) {
    userText += `\n\nUSER FEEDBACK / CORRECTION:\n${feedback}\n\nPlease take another look and revise your recommendation based on this feedback.`;
  }

  const messages = [
    { role: "system", content: system },
    {
      role: "user",
      content: userText,
      images: responseImages.length ? responseImages : undefined
    }
  ];

  const body = {
    model,
    messages,
    stream: false,
    options: { num_ctx: 16384, temperature: 0.2 }
  };

  const res = await fetch("http://127.0.0.1:11435/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.message?.content || "No response from model.";
}
