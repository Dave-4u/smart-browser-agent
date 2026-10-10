// Content script — tailored for the Mindrift / Toloka labeling page
// Extracts the prompt, source descriptions, and actual Response images as base64

function waitForImage(img, timeout = 5000) {
  return new Promise((resolve) => {
    if (img.complete && img.naturalWidth > 0) {
      resolve(true);
      return;
    }
    const timer = setTimeout(() => resolve(false), timeout);
    img.onload = () => {
      clearTimeout(timer);
      resolve(true);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };
    // Force a reload attempt if it hasn't started
    if (!img.src) {
      resolve(false);
    }
  });
}

function imageToBase64(img) {
  return new Promise((resolve) => {
    try {
      if (!img.naturalWidth) {
        resolve(null);
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(img.naturalWidth, 768);
      canvas.height = Math.min(img.naturalHeight, 768);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
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

  // Source / Request images
  const sourceImgs = Array.from(document.querySelectorAll('img[alt^="source_image"], img[alt="Request Image"]'))
    .filter(img => img.naturalWidth > 50);

  // Response images — wait for them to load
  const img1 = document.querySelector('img[alt="image_1"]');
  const img2 = document.querySelector('img[alt="image_2"]');
  const responseImgs = [img1, img2].filter(Boolean);

  // Wait for both to have real dimensions
  for (const img of responseImgs) {
    await waitForImage(img);
  }

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
    responseImages: responseBase64,
    note: "Source images are context. You MUST choose Image 1 or Image 2."
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "EXTRACT_PAGE") {
    extractLabelingData().then(sendResponse);
    return true;
  }
});
