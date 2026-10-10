// Content script — runs on labeling pages
// Extracts the user prompt and the two Response images only

function extractLabelingData() {
  let prompt = "";

  // Try to find the Prompt block
  const promptSelectors = [
    "[class*=\"prompt\"]",
    "[class*=\"Prompt\"]",
    "[data-testid*=\"prompt\"]",
    ".prompt",
    "#prompt"
  ];
  for (const sel of promptSelectors) {
    const el = document.querySelector(sel);
    if (el && el.innerText && el.innerText.trim().length > 10) {
      prompt = el.innerText.trim();
      break;
    }
  }

  // Fallback: look for text that looks like the instruction
  if (!prompt) {
    const allText = document.body.innerText;
    const match = allText.match(/(?:prompt|request|instruction)[:\s]*([\s\S]{20,500})/i);
    prompt = match ? match[1].trim() : allText.slice(0, 800);
  }

  // Focus on Response / generated images only
  // Common patterns: Response block, generated images, Image 1 / Image 2
  let responseImages = [];

  // Strategy 1: look for a Response section and take images inside it
  const responseSelectors = [
    "[class*=\"response\"]",
    "[class*=\"Response\"]",
    "[class*=\"generated\"]",
    "[data-testid*=\"response\"]",
    ".response",
    "#response"
  ];

  for (const sel of responseSelectors) {
    const container = document.querySelector(sel);
    if (container) {
      responseImages = Array.from(container.querySelectorAll("img"))
        .filter(img => img.src && img.naturalWidth > 50);
      if (responseImages.length >= 2) break;
    }
  }

  // Strategy 2: if we didn't find a clear Response block, take the last two large images
  if (responseImages.length < 2) {
    const allImgs = Array.from(document.querySelectorAll("img"))
      .filter(img => img.src && img.naturalWidth > 100 && !img.src.includes("icon") && !img.src.includes("logo"));
    // Prefer the last two (often the generated ones)
    responseImages = allImgs.slice(-2);
  }

  // Limit to exactly two
  responseImages = responseImages.slice(0, 2);

  const imageDescriptions = responseImages.length
    ? responseImages.map((img, i) =>
        `Image ${i + 1} (Response): alt="${img.alt || ""}" size=${img.naturalWidth}x${img.naturalHeight}`
      ).join("\n")
    : "(Could not clearly identify the two Response images. There should be exactly two generated images to choose between.)";

  return {
    prompt,
    imageDescriptions,
    note: "Only choose between Image 1 and Image 2 from the Response block. Ignore source/request images."
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
