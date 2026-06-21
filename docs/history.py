import json
import os

if os.environ.get('VERCEL'):
    HISTORY_FILE = '/tmp/chat_history.json'
else:
    HISTORY_FILE = os.path.join(os.path.dirname(__file__), "chat_history.json")


def load_history():
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r") as f:
            return json.load(f)
    return []


def save_history(messages):
    try:
        with open(HISTORY_FILE, "w") as f:
            json.dump(messages, f, indent=2)
    except OSError:
        pass


def clear_history():
    try:
        if os.path.exists(HISTORY_FILE):
            os.remove(HISTORY_FILE)
    except OSError:
        pass
    return []
