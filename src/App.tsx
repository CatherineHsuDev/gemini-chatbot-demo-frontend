// App.tsx
import { useState } from "react";
import "./index.css";

type Role = "user" | "ai";

interface Message {
  role: Role;
  text: string;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  if (!baseUrl) {
    throw new Error("VITE_API_BASE_URL is not set");
  }

  const appendMessage = (role: Role, text: string) => {
    setMessages((prev) => [...prev, { role, text }]);
  };

  const handleSend = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;

    appendMessage("user", trimmed);
    setPrompt("");
    setLoading(true);
    let timeoutId: number | undefined;

    try {
      const controller = new AbortController();
      timeoutId = window.setTimeout(() => controller.abort(), 60_000);

      const res = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ prompt: trimmed }),
        signal: controller.signal,
      });

      // 專門處理 429（被 rate limit 擋掉）
      if (res.status === 429) {
        let detail = "Too many requests. Please try again later.";
        try {
          const data = await res.json();
          if (typeof data.detail === "string") {
            detail = data.detail;
          }
        } catch {
          // 如果不是 JSON，就用原始文字
          const text = await res.text();
          if (text) detail = text;
        }
        appendMessage("ai", `Rate limit reached! ${detail}`);
        return;
      }

      // 其他非 2xx 狀態
      if (!res.ok) {
        const text = await res.text();
        appendMessage("ai", `Error: ${text || res.statusText}`);
        return;
      }

      // 正常成功
      const data: { response: string } = await res.json();
      appendMessage("ai", data.response);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        appendMessage("ai", "Network timeout. Please try again.");
        return;
      }

      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      appendMessage("ai", `Network error: ${msg}`);
    } finally {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      setLoading(false);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (
    e
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="app-container">
      <h1 style={{ textAlign: "center" }}>Gemini Chat (React)</h1>

      <div id="chat-box">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`message-row ${m.role === "user" ? "right" : "left"}`}
          >
            {/* AI 在左邊：AI 標籤 + 內容 */}
            {m.role === "ai" && (
              <div className="label">
                <span>AI</span>
              </div>
            )}

            <div className="bubble">{m.text}</div>

            {/* User 在右邊：內容 + You 標籤 */}
            {m.role === "user" && (
              <div className="label">
                <span>You</span>
              </div>
            )}
          </div>
        ))}

        {loading && <div className="loading-text">AI is thinking…</div>}
      </div>

      <textarea
        rows={3}
        placeholder="Type your question here..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
        className="prompt-input"
      />

      <button onClick={handleSend} disabled={loading} className="send-button">
        {loading ? "Thinking..." : "Send"}
      </button>
    </div>
  );
}

export default App;
