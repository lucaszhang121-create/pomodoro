import requests
import subprocess

def play_local_sound(sound="Glass", repeat=3):
    sound_path = f"/System/Library/Sounds/{sound}.aiff"
    for _ in range(repeat):
        subprocess.Popen(["afplay", sound_path])

def send_push_notification(title, message):
    play_local_sound()

    response = requests.post("https://api.pushover.net/1/messages.json", data={
        "token": "a72fu8wqiopsxmbtfmdyh6v1mvdd9q",
        "user": "uxxacq3g91wqr7i6v9sns469tu3p9c",
        "title": title,
        "message": message,
        "sound": "siren",
    })

    if response.status_code == 200:
        print("Notification sent successfully!")
    else:
        print(f"Failed to send: {response.text}")

if __name__ == "__main__":
    send_push_notification("wsp", "wsp")