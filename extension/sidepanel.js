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

    // Show what was extracted so the user can verify
    extractedDiv.textContent =
      `PROMPT:\n${pageData.prompt || "(none found)"}\n\n` +
      `RESPONSE IMAGES:\n${pageData.imageDescriptions || "(none found)"}\n\n` +
      (pageData.note || "");

    resultDiv.textContent = "Asking local model (qwen2.5vl:3b)...";

    const response = await chrome.runtime.sendMessage({
      type: "ASK_OLLAMA",
      prompt: pageData.prompt,
      images: pageData.imageDescriptions
    });

    if (!response.success) {
      throw new Error(response.error || "Model failed");
    }

    resultDiv.textContent = response.result;
    statusDiv.textContent = "Review the extracted info and the recommendation. You decide whether to submit.";
  } catch (err) {
    resultDiv.textContent = "Error: " + err.message;
    statusDiv.innerHTML = '<span class="warning">Make sure Ollama is running on port 11435 and the extension is reloaded.</span>';
  } finally {
    analyzeBtn.disabled = false;
  }
});
