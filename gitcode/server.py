import os
import json
from flask import Flask, request, jsonify, send_from_directory
from AITool import AITool

app = Flask(__name__, static_folder='.', static_url_path='')

api_key = os.environ.get('OPENAI_API_KEY', '')
ai = None

def get_ai():
    global ai
    if ai is None:
        if not api_key:
            return None
        ai = AITool(api_key)
    return ai

@app.route('/')
def index():
    return send_from_directory('.', 'index2.html')

SPACEPROGRESS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'spaceprogress'))

@app.route('/spaceprogress/<path:filename>')
def spaceprogress_files(filename):
    return send_from_directory(SPACEPROGRESS_DIR, filename)

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)

@app.route('/api/chat', methods=['POST'])
def chat():
    tool = get_ai()
    if not tool:
        return jsonify({'error': 'OPENAI_API_KEY not set. Run: export OPENAI_API_KEY=your-key'}), 500
    data = request.get_json()
    message = data.get('message', '').strip()
    if not message:
        return jsonify({'error': 'Empty message'}), 400
    try:
        reply = tool.generate_text(message)
        return jsonify({'reply': reply})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/chat/clear', methods=['POST'])
def chat_clear():
    tool = get_ai()
    if tool:
        tool.clear_chat()
    return jsonify({'status': 'ok'})

@app.route('/api/chat/history')
def chat_history():
    tool = get_ai()
    if not tool:
        return jsonify({'messages': []})
    msgs = [m for m in tool.messages if m['role'] != 'system']
    return jsonify({'messages': msgs})

@app.route('/api/generate', methods=['POST'])
def generate_flashcards():
    tool = get_ai()
    if not tool:
        return jsonify({'error': 'OPENAI_API_KEY not set. Run: export OPENAI_API_KEY=your-key'}), 500
    data = request.get_json()
    text = data.get('text', '').strip()
    if not text:
        return jsonify({'error': 'No text provided'}), 400
    prompt = f"""Based on the following study material, generate 5-8 flashcards. Return ONLY valid JSON — an array of objects, each with "question", "answer", "subject", and "difficulty" (easy/medium/hard) fields. No markdown, no explanation.

Study material:
{text}"""
    try:
        reply = tool.generate_text(prompt, max_tokens=1500)
        reply = reply.strip()
        if reply.startswith('```'):
            reply = reply.split('\n', 1)[1] if '\n' in reply else reply[3:]
            if reply.endswith('```'):
                reply = reply[:-3]
            reply = reply.strip()
        cards = json.loads(reply)
        tool.messages = tool.messages[:-2]
        return jsonify({'cards': cards})
    except json.JSONDecodeError:
        tool.messages = tool.messages[:-2]
        return jsonify({'error': 'Failed to parse flashcards. Try again.'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    if not api_key:
        print('WARNING: OPENAI_API_KEY not set. Nova and Flashcards will not work.')
        print('Run: export OPENAI_API_KEY=your-key-here')
    print('Starting FocusOS server at http://localhost:8000')
    app.run(host='0.0.0.0', port=8000, debug=True)
