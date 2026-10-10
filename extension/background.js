// Background service worker
// Handles Ollama API calls and side panel opening

chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ASK_OLLAMA") {
    askOllama(message.prompt, message.images)
      .then((result) => sendResponse({ success: true, result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async
  }
});

async function askOllama(prompt, imageDescriptions) {
  const model = "qwen2.5vl:3b";

  const system = `You are a careful labeling assistant for a preference task.

There are two kinds of images:
- SOURCE / REQUEST images: the original images the user provided with the prompt. Use these for context (what needs to be edited or referenced).
- RESPONSE images: the two generated images you must choose between. They are labeled Image 1 and Image 2.

Your job: recommend ONLY Image 1 or Image 2 (or both only if truly equal) as the better response to the prompt, considering the source images.
Never mention Image 3 or any higher number.
Explain your reasoning in plain language.
Do NOT tell the user to click submit.`;

  const userContent = `PROMPT:\n${prompt}\n\n${imageDescriptions || "(no image info)"}\n\nWhich Response image is better — Image 1 or Image 2 — and why?`;

  const body = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userContent }
    ],
    stream: false,
    options: { num_ctx: 16384 }
  };

  // Using port 11435 to avoid conflicts with an already-running Ollama on 11434
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
