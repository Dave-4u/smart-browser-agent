// Content script — runs on labeling pages
// Extracts the user prompt and image options

function extractLabelingData() {
  // Common patterns for Mindrift / Toloka / preference labeling pages
  // Adjust selectors if the page structure differs

  let prompt = "";
  // Try common prompt containers
  const promptSelectors = [
    "[class*=\"prompt\"]",
    "[class*=\"instruction\"]",
    "[class*=\"request\"]",
    "[data-testid*=\"prompt\"]",
    "h1", "h2", "h3",
    ".task-description",
    "p"
  ];

  for (const sel of promptSelectors) {
    const el = document.querySelector(sel);
    if (el && el.innerText && el.innerText.length > 20) {
      prompt = el.innerText.trim();
      break;
    }
  }

  // Fallback: grab a reasonable chunk of visible text
  if (!prompt) {
    prompt = document.body.innerText.slice(0, 1500);
  }

  // Extract image sources / alt texts
  const images = Array.from(document.querySelectorAll("img"))
    .filter(img => img.src && !img.src.includes("icon") && !img.src.includes("logo"))
    .slice(0, 6)
    .map((img, i) => `Image ${i + 1}: alt="${img.alt || ""}" src=${img.src.slice(0, 80)}...`);

  const imageDescriptions = images.join("\n") || "(images present on page — examine them)";

  return { prompt, imageDescriptions };
}

// Listen for requests from the side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "EXTRACT_PAGE") {
    const data = extractLabelingData();
    sendResponse(data);
    return true;
  }
});
