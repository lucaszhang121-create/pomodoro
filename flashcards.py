import cohere
import json
import os
from dotenv import load_dotenv

load_dotenv()
co = cohere.ClientV2(api_key=os.getenv("COHERE_API_KEY"))

def generate_flashcards(conversation_history: list):
    convo_text = ""
    for msg in conversation_history:
        role = msg["role"].upper()
        convo_text += f"{role}: {msg['content']}\n"

    response = co.chat(
        model="command-r-plus",
        messages=[
            {
                "role": "system",
                "content": """
                You are a flashcard generator for K-12 students.
                Analyze the conversation and extract key concepts the student learned.
                Return ONLY a JSON array, no extra text, like this:
                [
                  {
                    "question": "What is photosynthesis?",
                    "answer": "The process plants use to convert sunlight into food",
                    "subject": "Biology",
                    "difficulty": "medium"
                  }
                ]
                Rules:
                - Only return JSON, nothing else
                - Keep answers to 1-2 sentences
                - difficulty must be easy, medium, or hard
                - Generate 3 to 10 cards based on how much was covered
                """
            },
            {
                "role": "user",
                "content": f"Here is the study conversation:\n{convo_text}\nGenerate flashcards from this."
            }
        ]
    )

    raw = response.message.content[0].text
    clean = raw.replace("```json", "").replace("```", "").strip()
    cards = json.loads(clean)
    return cards