// Content script — tailored for the Mindrift / Toloka labeling page
// Extracts the prompt, source/request images, and the two response images

function extractLabelingData() {
  // Prompt
  let prompt = "";
  const promptEl = document.querySelector(".prompt-text") || document.querySelector(".prompt-container");
  if (promptEl) {
    prompt = promptEl.innerText.trim();
  } else {
    const match = document.body.innerText.match(/PROMPT\s*([\s\S]{5,400})/i);
    prompt = match ? match[1].trim() : "(prompt not found)";
  }

  // Source / Request images (the ones the user sent with the prompt)
  const sourceImgs = Array.from(document.querySelectorAll('img[alt^="source_image"], img[alt="Request Image"]'))
    .filter(img => img.naturalWidth > 50);

  // Response images (the two generated ones to choose between)
  const img1 = document.querySelector('img[alt="image_1"]');
  const img2 = document.querySelector('img[alt="image_2"]');
  const responseImgs = [img1, img2].filter(Boolean);

  let imageDescriptions = "";

  if (sourceImgs.length) {
    imageDescriptions += "SOURCE / REQUEST IMAGES (what the user provided):\n";
    imageDescriptions += sourceImgs.map((img, i) =>
      `Source ${i + 1}: alt="${img.alt}" size=${img.naturalWidth}x${img.naturalHeight}`
    ).join("\n");
    imageDescriptions += "\n\n";
  }

  if (responseImgs.length === 2) {
    imageDescriptions += "RESPONSE IMAGES (choose between these two):\n";
    imageDescriptions += responseImgs.map((img, i) =>
      `Image ${i + 1}: alt="${img.alt}" size=${img.naturalWidth}x${img.naturalHeight}`
    ).join("\n");
  } else {
    imageDescriptions += "(Could not find the two Response images image_1 and image_2.)";
  }

  return {
    prompt,
    imageDescriptions,
    note: "Source images are for context. Choose only between Response Image 1 and Response Image 2."
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
