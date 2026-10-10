
import { useState } from "react";
import "./App.css";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import KnowledgeBase from "./KnowledgeBase";

function App() {
  const [provider, setProvider] = useState("gemini");
  const [model, setModel] = useState("gemini-flash");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeController, setActiveController] = useState(null);
  const [activePage, setActivePage] = useState("chat");

  function changeProvider(nextProvider) {
    setProvider(nextProvider);
    setModel(
      nextProvider === "gemini"
        ? "gemini-flash"
        : nextProvider === "openai"
          ? "openai-luna"
          : "test-model"
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setError("");

    const updatedMessages = [
      ...messages,
      { role: "user", content: text },
    ];

    const assistantIndex = updatedMessages.length;

    setMessages([
      ...updatedMessages,
      { role: "assistant", content: "" },
    ]);

    const controller = new AbortController();
    setActiveController(controller);
    setLoading(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || "";

      const response = await fetch(`${apiUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          tenantId: "tenant-a",
          provider,
          model,
          message: text,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || body.message || `Request failed (${response.status})`);
      }

      if (!response.body) {
        throw new Error("Your browser does not support streaming responses.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";

      function updateAssistant(content) {
        setMessages((current) =>
          current.map((message, index) =>
            index === assistantIndex
              ? { ...message, content }
              : message
          )
        );
      }

      function processEvent(rawEvent) {
        const dataLine = rawEvent
          .split("\n")
          .find((line) => line.startsWith("data:"));

        if (!dataLine) return;

        const data = dataLine.slice(5).trim();

        try {
          const event = JSON.parse(data);

          if (event.type === "text_delta") {
            assistantText += event.text || "";
            updateAssistant(assistantText);
          } else if (event.type === "error") {
            throw new Error(event.error?.message || "The AI provider returned an error.");
          }
        } catch (err) {
          if (err instanceof SyntaxError) return;
          throw err;
        }
      }

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const event of events) {
          processEvent(event);
        }
      }

      buffer += decoder.decode();
      if (buffer.trim()) processEvent(buffer);

      if (!assistantText.trim()) {
        updateAssistant("(No text response returned.)");
      }
    } catch (err) {
      if (err.name === "AbortError") {
        setError("Generation cancelled.");
      } else {
        setError(err.message || "Something went wrong.");
      }
    } finally {
      setLoading(false);
      setActiveController(null);
    }
  }

  function cancelGeneration() {
    activeController?.abort();
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">P</div>
          <div>
            <h2>Polyglot</h2>
            <span>AI Workbench</span>
          </div>
        </div>

        <button
          className="new-chat"
          onClick={() => {
            if (loading) return;
            setMessages([]);
            setError("");
          }}
        >
          + New conversation
        </button>

        <div className="sidebar-section">
          <span className="section-label">WORKSPACE</span>
          <button
            className={`nav-item ${activePage === "chat" ? "active" : ""}`}
            onClick={() => setActivePage("chat")}
          >
            ◈ &nbsp; Chat playground
          </button>
          <button
            className="nav-item"
            onClick={() => setActivePage("knowledge")}
          >
            Knowledge base
          </button>
          <div className="nav-item">⌁ &nbsp; Usage & metrics</div>
        </div>

        <div className="sidebar-footer">
          <div className="status-dot" />
          <span>Local development</span>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <span className="breadcrumb">Workspace /</span>
            <strong> Chat playground</strong>
          </div>
          <div className="backend-status">
            <span className="status-dot" />
            Polyglot API
          </div>
        </header>

        {activePage === "knowledge" ? (
          <KnowledgeBase />
        ) : (
          <section className="chat-layout">
            <div className="chat-heading">
              <span className="eyebrow">POLYGLOT PLAYGROUND</span>
              <h1>Your AI workspace.</h1>
              <p>One interface. Multiple models. Your own knowledge.</p>
            </div>

            <div className="model-controls">
              <label>
                <span>PROVIDER</span>
                <select
                  value={provider}
                  disabled={loading}
                  onChange={(e) => changeProvider(e.target.value)}
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="test">Test provider</option>
                </select>
              </label>

              <label>
                <span>MODEL</span>
                <select
                  value={model}
                  disabled={loading}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {provider === "gemini" && (
                    <option value="gemini-flash">Gemini Flash</option>
                  )}
                  {provider === "openai" && (
                    <option value="openai-luna">OpenAI model</option>
                  )}
                  {provider === "test" && (
                    <option value="test-model">Test model</option>
                  )}
                </select>
              </label>
            </div>

            <div className="messages">
              {messages.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">✳</div>
                  <h2>What would you like to explore?</h2>
                  <p>Ask a question, test a model, or chat with your documents.</p>

                  <div className="suggestions">
                    {[
                      "Explain retrieval-augmented generation",
                      "Calculate 125 × 48",
                      "How does streaming work?",
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        disabled={loading}
                        onClick={() => setInput(suggestion)}
                      >
                        {suggestion} <span>↗</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div className="message" key={index}>
                    <div className={`avatar ${message.role}`}>
                      {message.role === "user" ? "Y" : "P"}
                    </div>
                    <div>
                      <strong>
                        {message.role === "user" ? "You" : "Polyglot"}
                      </strong>
                      <div className="message-content">
                        {message.content ? (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                          </ReactMarkdown>
                        ) : loading && index === messages.length - 1 ? (
                          "Thinking..."
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {error && <div className="error-message">{error}</div>}

            <form className="composer" onSubmit={handleSubmit}>
              <textarea
                value={input}
                disabled={loading}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Message Polyglot..."
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form.requestSubmit();
                  }
                }}
              />

              <div className="composer-footer">
                <span>Enter to send · Shift + Enter for a new line</span>

                {loading ? (
                  <button type="button" onClick={cancelGeneration}>
                    Stop ■
                  </button>
                ) : (
                  <button type="submit" disabled={!input.trim()}>
                    Send <span>↑</span>
                  </button>
                )}
              </div>
            </form>

            <p className="disclaimer">
              AI responses may be inaccurate. Verify important information.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;