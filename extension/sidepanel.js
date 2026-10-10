const analyzeBtn = document.getElementById("analyze");
const correctBtn = document.getElementById("correct");
const feedbackBox = document.getElementById("feedback");
const extractedDiv = document.getElementById("extracted");
const resultDiv = document.getElementById("result");
const statusDiv = document.getElementById("status");

let lastPageData = null;

async function runAnalysis(feedback = "") {
  analyzeBtn.disabled = true;
  correctBtn.disabled = true;
  resultDiv.textContent = feedback ? "Re-evaluating with your feedback..." : "Asking local model...";
  statusDiv.textContent = "";

  try {
    const response = await chrome.runtime.sendMessage({
      type: "ASK_OLLAMA",
      prompt: lastPageData.prompt,
      images: lastPageData.imageDescriptions,
      responseImages: lastPageData.responseImages || [],
      feedback
    });

    if (!response.success) {
      throw new Error(response.error || "Model failed");
    }

    resultDiv.textContent = response.result;
    statusDiv.textContent = "Review the recommendation. You decide whether to submit.";
  } catch (err) {
    resultDiv.textContent = "Error: " + err.message;
    statusDiv.innerHTML = '<span class="warning">Make sure Ollama is running on port 11435 and the page is refreshed.</span>';
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
      `Response images captured: ${lastPageData.responseImages?.length || 0}\n` +
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
  await runAnalysis(feedback);
});
