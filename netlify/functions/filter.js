// filter.js
function isQuestionValid(userInput) {
  const bannedKeywords = [
    "joke", "funny", "lol", "haha", "laugh",
    "crush", "kiss", "hug", "flirt",
    "dating", "sex",
    "boyfriend", "girlfriend",
    "do you love me", "tell me a joke", "marry me", "i love you",
    "chat with me", "best friend", "are you single", "romantic", "cute"
  ];

  const userInputLower = userInput.toLowerCase();
  for (const word of bannedKeywords) {
    if (userInputLower.includes(word)) {
      return false;
    }
  }
  return true;
}

module.exports = isQuestionValid;
