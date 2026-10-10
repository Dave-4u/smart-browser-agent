// Content script — extracts prompt and image URLs (background will fetch the actual images)

async function extractLabelingData() {
  // Prompt
  let prompt = "";
  const promptEl = document.querySelector(".prompt-text") || document.querySelector(".prompt-container");
  if (promptEl) {
    prompt = promptEl.innerText.trim();
  } else {
    const match = document.body.innerText.match(/PROMPT\s*([\s\S]{5,400})/i);
    prompt = match ? match[1].trim() : "(prompt not found)";
  }

  // Source images (descriptions)
  const sourceImgs = Array.from(document.querySelectorAll('img[alt^="source_image"], img[alt="Request Image"]'))
    .filter(img => img.naturalWidth > 50);

  // Response images — collect their src URLs
  const img1 = document.querySelector('img[alt="image_1"]');
  const img2 = document.querySelector('img[alt="image_2"]');
  const responseImgs = [img1, img2].filter(Boolean);

  const responseUrls = responseImgs.map(img => img.src).filter(Boolean);

  let imageDescriptions = "";
  if (sourceImgs.length) {
    imageDescriptions += "SOURCE / REQUEST IMAGES (context only):\n";
    imageDescriptions += sourceImgs.map((img, i) =>
      `Source ${i + 1}: alt="${img.alt}" size=${img.naturalWidth}x${img.naturalHeight}`
    ).join("\n");
    imageDescriptions += "\n\n";
  }

  imageDescriptions += "RESPONSE IMAGES (the two you must choose between):\n";
  imageDescriptions += responseImgs.map((img, i) =>
    `Image ${i + 1}: alt="${img.alt}" size=${img.naturalWidth}x${img.naturalHeight}`
  ).join("\n");

  return {
    prompt,
    imageDescriptions,
    responseUrls,          // background will fetch these
    note: "Source images are context. You MUST choose Image 1 or Image 2."
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "EXTRACT_PAGE") {
    extractLabelingData().then(sendResponse);
    return true;
  }
});
