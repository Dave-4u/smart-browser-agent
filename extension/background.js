// Background service worker
// Handles Ollama API calls and side panel opening

chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ASK_OLLAMA") {
    askOllama(message.prompt, message.images, message.responseImages)
      .then((result) => sendResponse({ success: true, result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async
  }
});

async function askOllama(prompt, imageDescriptions, responseImages = []) {
  const model = "qwen2.5vl:3b";

  const system = `You are a careful labeling assistant for a preference task.

Rules you must follow:
- There are always exactly two Response images: Image 1 and Image 2.
- You MUST recommend Image 1, Image 2, or (only in rare exceptional cases) both.
- Never say "neither", "none", or refuse to choose.
- Source/Request images are context only. The actual Response images are attached so you can see them.
- Judge using the selection criteria: prompt compliance first (but not alone), then anatomy/scene correctness, cohesion, artifacts, and overall quality.
- Weigh how serious and visible each problem is.
- Explain your reasoning in plain language and clearly state your final choice.
- Do NOT tell the user to click submit.`;

  const userText = `PROMPT:\n${prompt}\n\n${imageDescriptions || ""}\n\nThe two Response images are attached. Which one is the better response — Image 1 or Image 2 — and why?`;

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
    options: { num_ctx: 16384 }
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
