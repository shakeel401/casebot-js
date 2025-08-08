def is_question_valid(user_input: str) -> bool:
    banned_keywords = [
        "joke", "funny", "lol", "haha", "laugh",
        "crush", "kiss", "hug", "flirt",
        "dating","sex",
        "boyfriend", "girlfriend",
        "do you love me", "tell me a joke", "marry me", "i love you",
        "chat with me", "best friend", "are you single", "romantic", "cute"
    ]

    user_input_lower = user_input.lower()
    for word in banned_keywords:
        if word in user_input_lower:
            return False
    return True
