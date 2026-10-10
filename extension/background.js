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

  const system = `You are a careful labeling assistant. The user is doing a preference labeling task.
Read the user's request carefully and compare the options.
Recommend which image/option is the better response and explain why in plain language.
Do NOT tell the user to click submit. Just recommend and explain.
If images are described, use those descriptions.`;

  const userContent = `User request / prompt:\n${prompt}\n\nOptions / images:\n${imageDescriptions || "(no image descriptions extracted — look at the page visually if needed)"}\n\nWhich option is the better response and why?`;

  const body = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userContent }
    ],
    stream: false,
    options: { num_ctx: 16384 }
  };

  const res = await fetch("http://127.0.0.1:11434/api/chat", {
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
