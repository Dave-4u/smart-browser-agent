# Smart Labeling Assistant — Chrome Extension

Runs inside the page you are already logged into. Extracts the labeling prompt and images, asks your local Ollama model which option is better, and shows the recommendation in a side panel. You stay in control — it never submits for you.

## Requirements

- Chrome (or Edge/Brave)
- Ollama running locally
- Model pulled: `qwen2.5vl:3b` (or change the model name in `background.js`)

## One-time setup

### 1. Allow the extension to talk to Ollama

Ollama blocks browser extensions by default. Start it with CORS allowed:

**PowerShell (Windows):**
```powershell
$env:OLLAMA_ORIGINS="chrome-extension://*,http://localhost:*,http://127.0.0.1:*"
ollama serve
```

**Command Prompt:**
```cmd
set OLLAMA_ORIGINS=chrome-extension://*,http://localhost:*,http://127.0.0.1:* && ollama serve
```

Leave that terminal open while you use the extension.

### 2. Load the extension

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `extension` folder from this repo

### 3. Use it

1. Go to your labeling page (already logged in)
2. Click the extension icon → it opens the side panel
3. Click **Analyze this page**
4. Read the recommendation and decide yourself

## Notes

- The content script tries common selectors for the prompt. If the page structure is unusual, you may need to tweak `content.js`.
- It currently sends text descriptions of images (not raw pixels) to keep the request small. For stronger vision you can later add screenshot capture.
- All inference stays on your machine.

## Changing the model

Edit the `model` variable in `background.js` and pull the new model with `ollama pull <name>`.
