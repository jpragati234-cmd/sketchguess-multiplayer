import { memo } from "react";

interface WordPromptProps {
  word: string | null;
  isDrawer: boolean;
  roundEnded: boolean;
}

function WordPromptImpl({ word, isDrawer, roundEnded }: WordPromptProps) {
  if (!word) {
    return <div className="word-prompt word-prompt--empty">Waiting for round…</div>;
  }

  if (isDrawer) {
    return (
      <div className={`word-prompt word-prompt--drawer ${roundEnded ? "is-revealed" : ""}`}>
        <span className="word-prompt__label">Draw:</span>
        <span className="word-prompt__word">{word}</span>
      </div>
    );
  }

  if (roundEnded) {
    return (
      <div className="word-prompt word-prompt--revealed">
        <span className="word-prompt__label">Word was:</span>
        <span className="word-prompt__word word-prompt__word--reveal">{word}</span>
      </div>
    );
  }

  // Guessers see blanks — one per letter.
  const letters = word.replace(/[^a-zA-Z]/g, "").split("");
  return (
    <div className="word-prompt word-prompt--hidden">
      {letters.map((_, i) => (
        <span key={i} className="word-prompt__blank" />
      ))}
    </div>
  );
}

export const WordPrompt = memo(WordPromptImpl);
