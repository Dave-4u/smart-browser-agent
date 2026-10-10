# Smart Browser Agent

A safe, local-first AI agent that controls your browser like a human to assist with any website-related task (research, form filling, preference labeling, data extraction, etc.).

**Key features:**
- Works entirely in the browser (no access to your files or OS)
- Runs locally with Ollama (no API key required) or with cloud models
- Human guidance mode: shows reasoning and asks for confirmation before important actions
- Learns from your task instructions via strong system prompts and memory
- Perfect for tasks like "check prompt and select best image", research, shopping, etc.

## Prerequisites

1. **Python 3.11+**
2. **Ollama** (for local, free, private use)
   - Download from https://ollama.com
   - After install, run in terminal:
     ```bash
     ollama pull qwen2.5:14b
     # or better vision model if you have VRAM:
     # ollama pull qwen3-vl:8b
     ```
   - Keep Ollama running (`ollama serve` or it auto-starts)

3. **Optional**: API keys for stronger models (OpenAI, Anthropic, Google) if local model is too weak.

## Quick Setup

```bash
# 1. Create virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Install browser
playwright install chromium
```

## Usage

### Basic run (local model)
```bash
python agent.py
```

It will ask for your task. Example tasks:
- "Go to a preference labeling site, read the prompt, and select the image that best matches it"
- "Research the best laptops under $1000 and summarize top 3"
- "Fill out this form with my details" (it will ask you for data)

### Human guidance mode (recommended)
The agent pauses before major actions and shows its reasoning so you can guide it.

### Switching to stronger models
Edit the `LLM_PROVIDER` in `agent.py` or set environment variables.

## Safety

- The agent **cannot** delete files, access your filesystem, or control anything outside the browser.
- It uses a dedicated browser profile.
- You can watch the browser window the whole time.
- Strong system prompt forbids dangerous actions.

## Tips for best results

- For image preference tasks: use a vision-capable model (`qwen3-vl:8b` or cloud model).
- Give clear, detailed instructions in the task.
- Start with simple tasks and build up.
- Use confirmation mode until you trust it.

## Project Structure

- `agent.py` — Main agent with safety + guidance
- `requirements.txt` — Dependencies
- `README.md` — This file

Enjoy your personal browser assistant!
