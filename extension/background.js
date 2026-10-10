// Background service worker
// Uses Gemini API for image understanding

chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ASK_GEMINI") {
    askGemini(message.prompt, message.images, message.responseUrls, message.feedback)
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
  if (message.type === "SAVE_API_KEY") {
    chrome.storage.local.set({ geminiApiKey: message.key })
      .then(() => sendResponse({ success: true }));
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

async function askGemini(prompt, imageDescriptions, responseUrls = [], feedback = "") {
  const { geminiApiKey } = await chrome.storage.local.get("geminiApiKey");
  if (!geminiApiKey) {
    throw new Error("No Gemini API key saved. Paste it in the side panel first.");
  }

  const pastLessons = await getPastLessons();

  // Fetch images
  const imageParts = [];
  for (const url of responseUrls) {
    const b64 = await urlToBase64(url);
    if (b64) {
      imageParts.push({
        inline_data: {
          mime_type: "image/jpeg",
          data: b64
        }
      });
    }
  }

  let system = `You are an image preference labeling assistant.

CRITICAL RULES:
- You MUST always choose between Image 1 and Image 2.
- Never refuse or say you cannot judge.
- Start your answer with "Image 1" or "Image 2" (or "Both"), then explain.
- Do not tell the user to submit.`;

  if (pastLessons) {
    system += `\n\nPAST CORRECTIONS FROM THE USER (apply these lessons):\n${pastLessons}`;
  }

  let userText = `PROMPT:\n${prompt}\n\n${imageDescriptions || ""}\n\nThe two Response images are attached (first = Image 1, second = Image 2). Which is better and why?`;

  if (feedback) {
    userText = `IMPORTANT CORRECTION:\n${feedback}\n\nRe-examine the images and choose the correct one.\n\nPROMPT:\n${prompt}\n\n${imageDescriptions || ""}`;
  }

  const parts = [{ text: userText }, ...imageParts];

  const body = {
    contents: [
      {
        role: "user",
        parts
      }
    ],
    systemInstruction: {
      parts: [{ text: system }]
    },
    generationConfig: {
      temperature: 0.3
    }
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return text || "No response from Gemini.";
}
