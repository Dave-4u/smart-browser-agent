// Content script — tailored for the Mindrift / Toloka labeling page
// Prompt is in .prompt-text
// The two images to choose between have alt="image_1" and alt="image_2"

function extractLabelingData() {
  // Prompt
  let prompt = "";
  const promptEl = document.querySelector(".prompt-text") || document.querySelector(".prompt-container");
  if (promptEl) {
    prompt = promptEl.innerText.trim();
  } else {
    // Fallback
    const match = document.body.innerText.match(/PROMPT\s*([\s\S]{5,400})/i);
    prompt = match ? match[1].trim() : "(prompt not found)";
  }

  // The two Response images
  const img1 = document.querySelector('img[alt="image_1"]');
  const img2 = document.querySelector('img[alt="image_2"]');

  const responseImages = [img1, img2].filter(Boolean);

  let imageDescriptions = "";
  if (responseImages.length === 2) {
    imageDescriptions = responseImages.map((img, i) =>
      `Image ${i + 1}: alt="${img.alt}" size=${img.naturalWidth}x${img.naturalHeight}`
    ).join("\n");
  } else {
    imageDescriptions = "(Could not find image_1 and image_2. Found: " + responseImages.length + ")";
  }

  return {
    prompt,
    imageDescriptions,
    note: "Selecting between the two Response images (image_1 and image_2)."
  };
}

// Listen for requests from the side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "EXTRACT_PAGE") {
    const data = extractLabelingData();
    sendResponse(data);
    return true;
  }
});
