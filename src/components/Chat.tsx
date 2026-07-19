import { memo, useEffect, useRef, useState } from "react";
import type { Guess } from "../types/game";

interface ChatProps {
  guesses: Guess[];
  canGuess: boolean;
  onSubmit: (text: string) => void;
}

function ChatImpl({ guesses, canGuess, onSubmit }: ChatProps) {
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [guesses]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    onSubmit(text);
    setInput("");
  };

  return (
    <div className="chat">
      <div className="chat__header">Guesses</div>
      <div className="chat__list" ref={listRef}>
        {guesses.length === 0 && (
          <div className="chat__empty">Take a guess…</div>
        )}
        {guesses.map((g) => (
          <div
            key={g.id}
            className={`chat__msg ${g.is_correct ? "is-correct" : ""}`}
          >
            <span className="chat__author">{g.player_name}:</span>{" "}
            <span className="chat__text">
              {g.is_correct ? "guessed the word!" : g.text}
            </span>
          </div>
        ))}
      </div>
      <form
        className="chat__input"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={canGuess ? "Type your guess…" : "You are drawing…"}
          disabled={!canGuess}
          maxLength={60}
          autoComplete="off"
        />
        <button type="submit" disabled={!canGuess || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

export const Chat = memo(ChatImpl);
