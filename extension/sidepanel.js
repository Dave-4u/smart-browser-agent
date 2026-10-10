const analyzeBtn = document.getElementById("analyze");
const resultDiv = document.getElementById("result");
const statusDiv = document.getElementById("status");

analyzeBtn.addEventListener("click", async () => {
  analyzeBtn.disabled = true;
  resultDiv.textContent = "Extracting page content...";
  statusDiv.textContent = "";

  try {
    // Ask content script for page data
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab");

    const pageData = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PAGE" });

    resultDiv.textContent = "Asking local model (qwen2.5vl:3b)...";

    // Ask background to call Ollama
    const response = await chrome.runtime.sendMessage({
      type: "ASK_OLLAMA",
      prompt: pageData.prompt,
      images: pageData.imageDescriptions
    });

    if (!response.success) {
      throw new Error(response.error || "Model failed");
    }

    resultDiv.textContent = response.result;
    statusDiv.textContent = "Review the recommendation. You decide whether to submit.";
  } catch (err) {
    resultDiv.textContent = "Error: " + err.message;
    statusDiv.innerHTML = '<span class="warning">Make sure Ollama is running with CORS allowed and the model is pulled.</span>';
  } finally {
    analyzeBtn.disabled = false;
  }
});
