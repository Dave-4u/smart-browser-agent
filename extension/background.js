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
There are ALWAYS exactly two generated images to choose between: Image 1 and Image 2 (from the Response block).
Ignore any source/request images.
Read the user's request carefully.
Recommend ONLY Image 1 or Image 2 (or both only if they are truly equal), and explain why in plain language.
Never mention Image 3 or any higher number.
Do NOT tell the user to click submit. Just recommend and explain.`;

  const userContent = `User request / prompt:\n${prompt}\n\nResponse options (only these two):\n${imageDescriptions || "(two Response images should be present)"}\n\nWhich is the better response — Image 1 or Image 2 — and why?`;

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
