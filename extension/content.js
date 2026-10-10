// Content script — tailored for the Mindrift / Toloka labeling page
// Extracts the prompt, source descriptions, and actual Response images as base64

function imageToBase64(img) {
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(img.naturalWidth, 768);
      canvas.height = Math.min(img.naturalHeight, 768);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      // Return only the base64 part
      resolve(dataUrl.split(",")[1] || null);
    } catch (e) {
      resolve(null);
    }
  });
}

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

  // Source / Request images (descriptions only for context)
  const sourceImgs = Array.from(document.querySelectorAll('img[alt^="source_image"], img[alt="Request Image"]'))
    .filter(img => img.naturalWidth > 50);

  // Response images (the two we must choose between) — capture as base64
  const img1 = document.querySelector('img[alt="image_1"]');
  const img2 = document.querySelector('img[alt="image_2"]');
  const responseImgs = [img1, img2].filter(Boolean);

  const responseBase64 = [];
  for (const img of responseImgs) {
    const b64 = await imageToBase64(img);
    if (b64) responseBase64.push(b64);
  }

  let imageDescriptions = "";
  if (sourceImgs.length) {
    imageDescriptions += "SOURCE / REQUEST IMAGES (context only):\n";
    imageDescriptions += sourceImgs.map((img, i) =>
      `Source ${i + 1}: alt="${img.alt}" size=${img.naturalWidth}x${img.naturalHeight}`
    ).join("\n");
    imageDescriptions += "\n\n";
  }

  imageDescriptions += "RESPONSE IMAGES (the two you must choose between — actual images are attached):\n";
  imageDescriptions += responseImgs.map((img, i) =>
    `Image ${i + 1}: alt="${img.alt}" size=${img.naturalWidth}x${img.naturalHeight}`
  ).join("\n");

  return {
    prompt,
    imageDescriptions,
    responseImages: responseBase64,   // array of base64 strings
    note: "Source images are context. You MUST choose Image 1 or Image 2."
  };
}

// Listen for requests from the side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "EXTRACT_PAGE") {
    extractLabelingData().then(sendResponse);
    return true; // async
  }
});
