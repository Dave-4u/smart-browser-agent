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
- You are not allowed to refuse or avoid choosing.
- The two Response images are attached.
- Start your answer with "Image 1" or "Image 2" (or "Both"), then explain.
- Do not tell the user to submit.`;

  let userText = `PROMPT:\n${prompt}\n\n${imageDescriptions || ""}\n\nLook at the two attached Response images. Which is better — Image 1 or Image 2 — and why?`;

  if (feedback) {
    userText = `IMPORTANT CORRECTION FROM THE USER (this overrides your previous judgment):
${feedback}

You previously chose the wrong image. Re-examine the attached Response images carefully with this correction in mind and choose the correct one.

PROMPT:\n${prompt}\n\n${imageDescriptions || ""}\n\nBased on the correction above, which Response image is actually better — Image 1 or Image 2 — and why?`;
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
    options: { num_ctx: 16384, temperature: 0.3 }
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
