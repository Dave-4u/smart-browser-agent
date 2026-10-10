const analyzeBtn = document.getElementById("analyze");
const extractedDiv = document.getElementById("extracted");
const resultDiv = document.getElementById("result");
const statusDiv = document.getElementById("status");

analyzeBtn.addEventListener("click", async () => {
  analyzeBtn.disabled = true;
  extractedDiv.textContent = "Extracting...";
  resultDiv.textContent = "";
  statusDiv.textContent = "";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab");

    const pageData = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PAGE" });

    extractedDiv.textContent =
      `PROMPT:\n${pageData.prompt || "(none found)"}\n\n` +
      `${pageData.imageDescriptions || "(none found)"}\n\n` +
      `Response images captured: ${pageData.responseImages?.length || 0}\n` +
      (pageData.note || "");

    resultDiv.textContent = "Asking local model (qwen2.5vl:3b) with images...";

    const response = await chrome.runtime.sendMessage({
      type: "ASK_OLLAMA",
      prompt: pageData.prompt,
      images: pageData.imageDescriptions,
      responseImages: pageData.responseImages || []
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
  }
});
