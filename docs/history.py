import json
import os

HISTORY_FILE = os.path.join(os.path.dirname(__file__), "chat_history.json")


def load_history():
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r") as f:
            return json.load(f)
    return []


def save_history(messages):
    with open(HISTORY_FILE, "w") as f:
        json.dump(messages, f, indent=2)


def clear_history():
    if os.path.exists(HISTORY_FILE):
        os.remove(HISTORY_FILE)
    return []
