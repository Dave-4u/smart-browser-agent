// Background service worker
// Uses Gemini API for image understanding
// Tuned with Toloka / Mindrift style labeling criteria + staged evaluation

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

const TOLOKA_CRITERIA = `
You are a trained Toloka / Mindrift image preference labeler.
Your job is to choose which of the two generated Response images is the better answer to the user's request.

Work through these stages IN ORDER. Do not skip stages. Pay attention to fine details — the exam mixes all of these.

=== STAGE 1: PROMPT RELEVANCE ===
Does the image actually do what was asked? Check EVERY requirement of the prompt against BOTH images.
- Prompt compliance is where you START, not where you stop.
- An image that follows the request to the letter can still lose if it is broken (anatomy, text, structure).
- Extra items, extra objects, or changes the prompt did NOT ask for are failures of compliance. Prefer the image that does only what was asked (and does it well).
- Grid / layout tasks: the primary requirement is alignment with the requested grid, layout, positions, or structure. Do NOT prefer an image just because the content in a cell looks nicer if it breaks the grid shape, order, or positions. Grid alignment wins over content preference inside cells.
- Local edits: only the requested region should change. Use the Difference / heatmap when available — for local edits it should be mostly black outside the edit zone. Bright areas outside the requested change are a strong signal against that image.
- Global edits (restyle whole image, change season/time of day, new medium, new camera angle, generate from reference): a fully lit heatmap is expected and is NOT a flaw. Ignore the heatmap for global tasks; judge whether the requested global change was done well and whether identity / required elements survived.

=== STAGE 2: ANATOMY AND STRUCTURE ===
Look hard for glitches a normal viewer notices in the first second:
- Extra or missing limbs, fingers, legs, heads
- Broken poses, melted faces, impossible joints
- Melted, garbled, or misspelled text
- Impossible perspective, floating objects, objects that do not hold together
- Cars, buildings, animals, or scene elements with wrong structure
These flaws usually decide the task. A slightly off shade is minor; three legs or melted text is major. Prefer the cleaner, structurally correct image even if the other is slightly closer on a small prompt detail.

=== STAGE 3: BEAUTY AND QUALITY ===
When nothing is clearly broken, judge how the image looks:
- Overall quality, resolution, lighting, color saturation, sharpness
- Cohesion: does it feel like one picture, or like elements pasted on top of each other?
- Artifacts: watermarks, signatures, unwanted frames, blob / radial backgrounds (unless the prompt asked for them)
- For edits of existing images: the result must match the source style — palette, lighting, contrast, visual style — like a natural continuation of the sources, not a separately generated picture. Prefer the image that is more consistent with the sources even if both look similar at first glance.

=== STAGE 4: GENERAL (FINAL) ===
Put it all together. Weigh every criterion the way you will on real tasks. Judge each image as a WHOLE and pick the one the person who sent the request would be happier to receive.
- Never choose "Both" unless the two images are truly equal after careful inspection. Extra items not requested, grid misalignment, or clear quality inconsistency means they are NOT equal — pick the better one.
- Trust what catches the eye first, then confirm with zoom/detail reasoning.

OUTPUT RULES:
- ALWAYS start with "Image 1" or "Image 2" (or "Both" only when truly equal).
- Then briefly walk through the stages that mattered (prompt → anatomy → beauty → final).
- Mention the Difference / heatmap when you used it for a local-edit decision.
- Do not refuse. Do not tell the user to submit.
`;

async function askGemini(prompt, imageDescriptions, responseUrls = [], feedback = "") {
  const { geminiApiKey } = await chrome.storage.local.get("geminiApiKey");
  if (!geminiApiKey) {
    throw new Error("No Gemini API key saved. Paste it in the side panel first.");
  }

  const pastLessons = await getPastLessons();

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

  let system = TOLOKA_CRITERIA;

  if (pastLessons) {
    system += `\n\nPAST CORRECTIONS FROM THE USER (apply these lessons strictly):\n${pastLessons}`;
  }

  let userText = `PROMPT:\n${prompt}\n\n${imageDescriptions || ""}\n\nThe two Response images are attached (first = Image 1, second = Image 2). Work through the stages (Prompt relevance → Anatomy and structure → Beauty and quality → General). Use the Difference/heatmap reasoning when the task is a local edit. Which is the better response and why?`;

  if (feedback) {
    userText = `IMPORTANT CORRECTION FROM THE USER:\n${feedback}\n\nRe-examine both Response images carefully with this correction and the staged Toloka criteria. Prefer the image that matches the correction.\n\nPROMPT:\n${prompt}\n\n${imageDescriptions || ""}`;
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
      temperature: 0.25
    }
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${geminiApiKey}`,
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
