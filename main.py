#!/usr/bin/env python3
"""TARS Voice Assistant — Interstellar Edition"""

import os
import sys
import time
from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from rich import box

load_dotenv()

console = Console()

TARS_BANNER = """
╔══════════════════════════════════════════╗
║   T A R S   —   Voice Interface v1.0    ║
║   Humor: 75%  |  Honesty: 90%           ║
║   Press  ENTER  to speak  |  q  to quit ║
╚══════════════════════════════════════════╝
"""


def check_api_key():
    if not os.getenv("ANTHROPIC_API_KEY"):
        console.print(
            Panel(
                "[red]ANTHROPIC_API_KEY not found.[/red]\n"
                "Create a [bold].env[/bold] file in this folder with:\n"
                "[cyan]ANTHROPIC_API_KEY=your_key_here[/cyan]",
                title="Configuration Error",
                border_style="red",
            )
        )
        sys.exit(1)


def print_tars(text: str):
    console.print(
        Panel(
            Text(text, style="bold cyan"),
            title="[white]TARS[/white]",
            border_style="cyan",
            box=box.HEAVY,
        )
    )


def print_user(text: str):
    console.print(
        Panel(
            Text(text, style="white"),
            title="[green]You[/green]",
            border_style="green",
        )
    )


def print_status(msg: str):
    console.print(f"[dim yellow]  ⟳  {msg}[/dim yellow]")


def main():
    check_api_key()

    # Lazy imports after key check
    from listener import record_until_silence, transcribe
    from speech import speak
    from brain import chat, reset

    console.print(f"[cyan]{TARS_BANNER}[/cyan]")

    # Pre-load Whisper model
    print_status("Loading Whisper speech recognition model...")
    from listener import _get_model
    _get_model()
    console.print("[green]  ✓  Ready.[/green]\n")

    intro = "TARS online. Humor setting: 75 percent. What do you need?"
    print_tars(intro)
    speak(intro)

    while True:
        try:
            console.print("\n[dim]Press [bold]ENTER[/bold] to speak, [bold]r[/bold] to reset, [bold]q[/bold] to quit:[/dim] ", end="")
            user_input = input().strip().lower()

            if user_input == "q":
                farewell = "Going offline. Try not to break anything."
                print_tars(farewell)
                speak(farewell)
                break

            if user_input == "r":
                reset()
                console.print("[yellow]  ✓  Conversation reset.[/yellow]")
                continue

            # Record voice
            console.print("[yellow]  ◉  Listening...[/yellow]")
            audio = record_until_silence()

            # Transcribe
            print_status("Transcribing...")
            text = transcribe(audio)

            if not text or len(text) < 2:
                console.print("[dim red]  ✗  Didn't catch that. Try again.[/dim red]")
                continue

            print_user(text)

            # Get TARS response
            print_status("Thinking...")
            response = chat(text)

            print_tars(response)
            speak(response)

        except KeyboardInterrupt:
            console.print("\n[dim]Interrupted.[/dim]")
            farewell = "Interrupt received. Shutting down."
            print_tars(farewell)
            speak(farewell)
            break
        except Exception as e:
            console.print(f"[red]  ✗  Error: {e}[/red]")


if __name__ == "__main__":
    main()
