import winsound

while True:
    user_input = input("Enter 'play' to play music or 'exit' to quit: ")
    if user_input.lower() == 'play':
        winsound.PlaySound("music.wav", winsound.SND_FILENAME)
    elif user_input.lower() == 'exit':
        break
