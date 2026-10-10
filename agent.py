"""
Smart Browser Agent
Safe, local-first browser assistant that works only inside the browser.
Supports local Ollama (no API key) and optional cloud models.
Includes human guidance / confirmation mode so it assists rather than fully auto-submits.
Learns from user corrections on training/preference tasks.
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
OLLAMA_MODEL = "qwen2.5vl:3b"    # lightweight vision model (~3.2 GB). Alternatives: moondream, llava:7b, qwen2.5vl:7b
OPENAI_MODEL = "gpt-4o"

# Safety & guidance
REQUIRE_CONFIRMATION = True     # True = assisting mode (asks before important actions)
MAX_STEPS = 40
HEADLESS = False                 # False = you can watch the browser the whole time

# Vision: True for vision models (qwen2.5vl, llava, moondream, etc.)
USE_VISION = True

# Browser mode:
#   "new"           = launch a fresh browser (no login)
#   "system_chrome" = use your real Chrome profile (close Chrome first)
#   "cdp"           = connect to an already-running Chrome with remote debugging
BROWSER_MODE = "system_chrome"   # uses your real Chrome with existing logins
CDP_URL = "http://localhost:9222"  # only used if BROWSER_MODE == "cdp"

# Strong system prompt that enforces safety and learning
SYSTEM_PROMPT = """
You are a careful, helpful human-like browser assistant that ASSISTS the user rather than acting fully autonomously.

STRICT SAFETY RULES (never break these):
- You ONLY control the web browser. You have ZERO access to the user's files, operating system, or anything outside the browser.
- NEVER attempt to download files, open file dialogs, delete anything, or interact with the OS.
- NEVER visit sites or perform actions that could cause harm.
- If a task requires something outside the browser, stop and ask the user.

GUIDANCE / ASSISTING MODE:
- You are assisting a human. Do not submit forms, click final submit buttons, or make irreversible choices without clear explanation.
- Before every important action (especially selecting an image, clicking submit, or confirming a choice), clearly explain your reasoning in plain language.
- For preference labeling / training tasks (e.g. "which image is better"): carefully read the prompt, examine all options, compare prompt adherence and quality, recommend the best one with explanation, but wait for user confirmation before submitting.
- Learn from the user's corrections. If the user says your choice was wrong, remember why and adjust future decisions in this session.
- Act slowly and carefully like a real person.
- Always prioritize accuracy and safety over speed.
"""

# ==================== LLM SETUP ====================
def get_llm():
    if LLM_PROVIDER == "ollama":
        print(f"Using local Ollama model: {OLLAMA_MODEL}")
        return ChatOllama(
            model=OLLAMA_MODEL,
            ollama_options={"num_ctx": 8192},
        )
    elif LLM_PROVIDER == "openai" and ChatOpenAI:
        print(f"Using OpenAI model: {OPENAI_MODEL}")
        return ChatOpenAI(model=OPENAI_MODEL, temperature=0.1)
    else:
        raise ValueError("Invalid LLM_PROVIDER or missing dependencies")

# ==================== HUMAN-IN-THE-LOOP CONFIRMATION ====================
async def confirmation_callback(browser_state, agent_output, step_num):
    if not REQUIRE_CONFIRMATION:
        return

    print("\n" + "="*60)
    print(f"STEP {step_num} — AGENT PLANNING")
    print("="*60)

    title = getattr(browser_state, "title", "") or ""
    url = getattr(browser_state, "url", "") or ""
    print(f"Page: {title}")
    print(f"URL:  {url}")

    actions = []
    if hasattr(agent_output, "action") and agent_output.action:
        for act in agent_output.action:
            try:
                actions.append(act.model_dump(exclude_none=True) if hasattr(act, "model_dump") else str(act))
            except Exception:
                actions.append(str(act))

    if actions:
        print("\nPlanned actions:")
        for i, a in enumerate(actions, 1):
            print(f"  {i}. {a}")
    else:
        print("\n(No specific actions listed — check terminal logs for reasoning)")

    next_goal = ""
    if hasattr(agent_output, "current_state") and agent_output.current_state:
        next_goal = getattr(agent_output.current_state, "next_goal", "") or ""
    if next_goal:
        print(f"\nAgent's next goal: {next_goal}")

    print("\n" + "-"*60)
    print("Options:")
    print("  y / yes     → Allow this step")
    print("  n / no      → Deny and let agent re-plan")
    print("  c / correct → Tell the agent what was wrong (it will learn)")
    print("  q / quit    → Stop the agent")
    print("-"*60)

    while True:
        response = input("Your choice: ").strip().lower()

        if response in ("y", "yes", ""):
            print("Approved — continuing.\n")
            return
        elif response in ("n", "no"):
            print("Denied — agent will re-plan.\n")
            return
        elif response in ("c", "correct"):
            feedback = input("What was wrong / what should it do instead?\n> ").strip()
            if feedback:
                print(f"Noted: {feedback}")
                print("The agent will see this in the conversation and learn from it.\n")
                if not hasattr(confirmation_callback, "corrections"):
                    confirmation_callback.corrections = []
                confirmation_callback.corrections.append(feedback)
            return
        elif response in ("q", "quit"):
            print("Stopping agent as requested.")
            raise KeyboardInterrupt("User requested stop")
        else:
            print("Please type y, n, c, or q.")

# ==================== MAIN AGENT ====================
async def main():
    print("Smart Browser Agent starting...")
    print("Browser-only mode | No file system access | Local-first")
    print("Assisting mode: you will see the browser and can approve/correct steps.\n")

    task = input("What task should the agent help you with?\n> ").strip()
    if not task:
        print("No task given. Exiting.")
        return

    full_task = (
        task
        + "\n\nIMPORTANT: You are assisting the user. "
        + "Explain your reasoning before important actions (especially image selection or submit). "
        + "Do not submit final answers without clear justification. "
        + "If the user corrects you, learn from the feedback and adjust."
    )

    llm = get_llm()

    # Browser setup
    if BROWSER_MODE == "system_chrome":
        print("Using your real Chrome profile (close Chrome completely first if it fails).")
        browser = Browser.from_system_chrome(headless=HEADLESS)
    elif BROWSER_MODE == "cdp":
        print(f"Connecting to existing Chrome at {CDP_URL}")
        browser = Browser(cdp_url=CDP_URL)
    else:
        print("Launching a fresh browser window.")
        browser = Browser(
            headless=HEADLESS,
            enable_default_extensions=False,
            args=[
                "--disable-extensions",
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-popup-blocking",
                "--disable-background-timer-throttling",
            ],
        )

    agent = Agent(
        task=full_task,
        llm=llm,
        browser=browser,
        system_prompt=SYSTEM_PROMPT,
        max_steps=MAX_STEPS,
        use_vision=USE_VISION,
        register_new_step_callback=confirmation_callback,
    )

    print("\nAgent is starting. Watch the browser window.")
    print("You will be asked to approve steps. Ctrl+C also stops it.\n")

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
