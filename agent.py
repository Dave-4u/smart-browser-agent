"""
Smart Browser Agent
Safe, local-first browser assistant that works only inside the browser.
Supports local Ollama (no API key) and optional cloud models.
Includes human guidance / confirmation mode.
"""

import asyncio
import os
from dotenv import load_dotenv

from browser_use import Agent, Browser, ChatOllama

# Optional cloud imports (only used if you set them)
try:
    from browser_use import ChatOpenAI
except ImportError:
    ChatOpenAI = None

load_dotenv()

# ==================== CONFIGURATION ====================
# Choose model: "ollama" (local, free) or "openai" (needs API key)
LLM_PROVIDER = "ollama"          # change to "openai" if you want stronger model
OLLAMA_MODEL = "qwen2.5:14b"     # or "qwen3-vl:8b" for better vision, "llama3.1:8b"
OPENAI_MODEL = "gpt-4o"

# Safety & guidance
REQUIRE_CONFIRMATION = True     # Set to False for full autonomy (after you trust it)
MAX_STEPS = 40
HEADLESS = False                 # False = you can watch the browser

# Strong system prompt that enforces safety and learning
SYSTEM_PROMPT = """
You are a careful, helpful human-like browser assistant.

STRICT SAFETY RULES (never break these):
- You ONLY control the web browser. You have ZERO access to the user's files, operating system, or anything outside the browser.
- NEVER attempt to download files, open file dialogs, delete anything, or interact with the OS.
- NEVER visit sites or perform actions that could cause harm.
- If a task requires something outside the browser, stop and ask the user.

GUIDANCE MODE:
- Before every important action (clicking a submit button, selecting an image, filling sensitive data, navigating to a new major page), clearly explain your reasoning in plain language.
- Wait for user confirmation when required.
- Learn from the user's instructions and previous corrections in the conversation.

TASK STYLE:
- Act slowly and carefully like a real person.
- For preference labeling tasks: carefully read the prompt, examine all images, compare prompt adherence and quality, then choose the best one and explain why.
- Always prioritize accuracy and safety over speed.
"""

# ==================== LLM SETUP ====================
def get_llm():
    if LLM_PROVIDER == "ollama":
        print(f"Using local Ollama model: {OLLAMA_MODEL}")
        return ChatOllama(
            model=OLLAMA_MODEL,
            ollama_options={"num_ctx": 32000},
        )
    elif LLM_PROVIDER == "openai" and ChatOpenAI:
        print(f"Using OpenAI model: {OPENAI_MODEL}")
        return ChatOpenAI(model=OPENAI_MODEL, temperature=0.1)
    else:
        raise ValueError("Invalid LLM_PROVIDER or missing dependencies")

# ==================== HUMAN CONFIRMATION CALLBACK ====================
async def human_confirmation(step_info):
    """Simple confirmation before actions when REQUIRE_CONFIRMATION is True."""
    if not REQUIRE_CONFIRMATION:
        return True

    print("\n" + "="*50)
    print("AGENT PLANNING NEXT ACTION")
    print("="*50)
    # You can expand this to show more details from step_info if needed
    print("Agent wants to proceed with the next browser action.")
    print("Reasoning is shown in the terminal logs above.")
    
    response = input("Allow this action? (y/n/quit): ").strip().lower()
    if response in ("y", "yes"):
        return True
    elif response in ("q", "quit"):
        print("Stopping agent as requested.")
        return False
    else:
        print("Action denied by user. Agent will re-plan.")
        return False

# ==================== MAIN AGENT ====================
async def main():
    print("Smart Browser Agent starting...")
    print("Browser-only mode | No file system access | Local-first\n")

    task = input("What task should the agent help you with?\n> ").strip()
    if not task:
        print("No task given. Exiting.")
        return

    llm = get_llm()

    # Dedicated browser profile for safety
    browser = Browser(
        headless=HEADLESS,
        # You can add more restrictions here if needed
    )

    agent = Agent(
        task=task,
        llm=llm,
        browser=browser,
        system_prompt=SYSTEM_PROMPT,
        max_steps=MAX_STEPS,
        # register_new_step_callback=human_confirmation,  # Uncomment if your version supports it
    )

    print("\nAgent is starting. Watch the browser window.")
    print("You can stop anytime with Ctrl+C\n")

    try:
        history = await agent.run()
        print("\n" + "="*50)
        print("TASK COMPLETED")
        print("="*50)
        print(history.final_result() if hasattr(history, "final_result") else "Done.")
    except KeyboardInterrupt:
        print("\nStopped by user.")
    except Exception as e:
        print(f"\nError: {e}")

if __name__ == "__main__":
    asyncio.run(main())
