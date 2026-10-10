// Background service worker
// Handles Ollama API calls, side panel, and persistent corrections

chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ASK_OLLAMA") {
    askOllama(message.prompt, message.images, message.responseUrls, message.feedback)
      .then((result) => sendResponse({ success: true, result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (message.type === "SAVE_CORRECTION") {
    saveCorrection(message.feedback, message.prompt)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function saveCorrection(feedback, prompt) {
  const { corrections = [] } = await chrome.storage.local.get("corrections");
  corrections.push({
    feedback,
    promptSnippet: (prompt || "").slice(0, 120),
    timestamp: Date.now()
  });
  const trimmed = corrections.slice(-30);
  await chrome.storage.local.set({ corrections: trimmed });
}

async function getPastLessons() {
  const { corrections = [] } = await chrome.storage.local.get("corrections");
  if (!corrections.length) return "";
  const recent = corrections.slice(-8);
  return recent.map((c, i) => `${i + 1}. ${c.feedback}`).join("\n");
}

async function urlToBase64(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result;
        resolve(dataUrl ? dataUrl.split(",")[1] : null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return null;
  }
}

async function askOllama(prompt, imageDescriptions, responseUrls = [], feedback = "") {
  const model = "qwen2.5vl:3b";
  const pastLessons = await getPastLessons();

  // Fetch the actual images in the background
  const responseImages = [];
  for (const url of responseUrls) {
    const b64 = await urlToBase64(url);
    if (b64) responseImages.push(b64);
  }

  let system = `You are an image preference labeling assistant.

CRITICAL RULES:
- You MUST always choose between Image 1 and Image 2.
- You are not allowed to refuse or avoid choosing.
- The two Response images are attached.
- Start your answer with "Image 1" or "Image 2" (or "Both"), then explain.
- Do not tell the user to submit.`;

  if (pastLessons) {
    system += `\n\nPAST CORRECTIONS FROM THE USER (apply these lessons):\n${pastLessons}`;
  }

  let userText = `PROMPT:\n${prompt}\n\n${imageDescriptions || ""}\n\nLook at the two attached Response images. Which is better — Image 1 or Image 2 — and why?`;

  if (feedback) {
    userText = `IMPORTANT CORRECTION FROM THE USER (this overrides your previous judgment):\n${feedback}\n\nYou previously chose the wrong image. Re-examine the attached Response images carefully with this correction in mind and choose the correct one.\n\nPROMPT:\n${prompt}\n\n${imageDescriptions || ""}\n\nBased on the correction above, which Response image is actually better — Image 1 or Image 2 — and why?`;
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
