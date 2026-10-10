const analyzeBtn = document.getElementById("analyze");
const correctBtn = document.getElementById("correct");
const feedbackBox = document.getElementById("feedback");
const extractedDiv = document.getElementById("extracted");
const resultDiv = document.getElementById("result");
const statusDiv = document.getElementById("status");
const apiKeyInput = document.getElementById("apiKey");
const saveKeyBtn = document.getElementById("saveKey");
const keyStatus = document.getElementById("keyStatus");

let lastPageData = null;

// Load saved key on open
chrome.storage.local.get("geminiApiKey").then(({ geminiApiKey }) => {
  if (geminiApiKey) {
    apiKeyInput.value = geminiApiKey;
    keyStatus.textContent = "Key loaded.";
  }
});

saveKeyBtn.addEventListener("click", async () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    keyStatus.textContent = "Paste a key first.";
    return;
  }
  await chrome.runtime.sendMessage({ type: "SAVE_API_KEY", key });
  keyStatus.textContent = "Key saved.";
});

async function runAnalysis(feedback = "") {
  analyzeBtn.disabled = true;
  correctBtn.disabled = true;
  resultDiv.textContent = feedback ? "Re-evaluating with your feedback..." : "Asking Gemini...";
  statusDiv.textContent = "";

  try {
    const response = await chrome.runtime.sendMessage({
      type: "ASK_GEMINI",
      prompt: lastPageData.prompt,
      images: lastPageData.imageDescriptions,
      responseUrls: lastPageData.responseUrls || [],
      feedback
    });

    if (!response.success) {
      throw new Error(response.error || "Model failed");
    }

    resultDiv.textContent = response.result;
    statusDiv.textContent = "Review the recommendation. You decide whether to submit.";
  } catch (err) {
    resultDiv.textContent = "Error: " + err.message;
    statusDiv.innerHTML = '<span class="warning">Check your API key and internet connection.</span>';
  } finally {
    analyzeBtn.disabled = false;
    correctBtn.disabled = false;
  }
}

analyzeBtn.addEventListener("click", async () => {
  extractedDiv.textContent = "Extracting...";
  resultDiv.textContent = "";
  feedbackBox.value = "";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab");

    lastPageData = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PAGE" });

    extractedDiv.textContent =
      `PROMPT:\n${lastPageData.prompt || "(none found)"}\n\n` +
      `${lastPageData.imageDescriptions || "(none found)"}\n\n` +
      `Response image URLs found: ${lastPageData.responseUrls?.length || 0}\n` +
      (lastPageData.note || "");

    await runAnalysis();
  } catch (err) {
    resultDiv.textContent = "Error: " + err.message;
  }
});

correctBtn.addEventListener("click", async () => {
  const feedback = feedbackBox.value.trim();
  if (!feedback) {
    statusDiv.textContent = "Type some feedback first.";
    return;
  }
  if (!lastPageData) {
    statusDiv.textContent = "Analyze the page first.";
    return;
  }

  await chrome.runtime.sendMessage({
    type: "SAVE_CORRECTION",
    feedback,
    prompt: lastPageData.prompt
  });

  await runAnalysis(feedback);
  statusDiv.textContent = "Correction saved and applied. It will be used on future tasks too.";
});
