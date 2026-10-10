
import { useState } from "react";
import './knowledgeBase.css';

export default function KnowledgeBase() {
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState("");

    async function handleUpload(event) {
        event.preventDefault();

        if (!selectedFile) {
            setMessage("Please select a document first.");
            return;
        }

        if (selectedFile.size > 5 * 1024 * 1024) {
            setMessage("The maximum file size is 5 MB.");
            return;
        }

        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("tenantId", "tenant-a");

        setUploading(true);
        setMessage("");

        try {
            const apiUrl = import.meta.env.VITE_API_URL || "";

            const response = await fetch(`${apiUrl}/api/documents`, {
                method: "POST",
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.message || "Upload failed.");
            }

            setMessage(data.message || "Document uploaded successfully.");
            setSelectedFile(null);
            event.target.reset();
        } catch (error) {
            setMessage(
                error.message || "Unable to upload the document. Please try again."
            );
        } finally {
            setUploading(false);
        }
    }

    return (
        <section className="knowledge-base">
            <div className="knowledge-base-header">
                <span className="eyebrow">YOUR KNOWLEDGE</span>
                <h1>Knowledge Base</h1>
                <p>
                    Upload documents and make their content available to your AI workspace.
                </p>
            </div>

            <form className="knowledge-upload-card" onSubmit={handleUpload}>
                <h2>Add a document</h2>
                <p className="knowledge-upload-description">
                    Select a document to add it to your workspace knowledge.
                </p>

                <label className="knowledge-dropzone" htmlFor="knowledge-document">
                    <span className="knowledge-upload-icon">↑</span>
                    <strong>
                        Drop your document here or{" "}
                        <span className="knowledge-browse">browse files</span>
                    </strong>
                    <span className="knowledge-file-hint">
                        PDF, TXT or Markdown · Maximum 5 MB
                    </span>
                    <input
                        className="knowledge-file-input"
                        id="knowledge-document"
                        type="file"
                        accept=".pdf,.txt,.md,.markdown"
                        disabled={uploading}
                        onChange={(event) => {
                            setSelectedFile(event.target.files?.[0] || null);
                            setMessage("");
                        }}
                    />
                </label>

                {selectedFile && (
                    <p>
                        Selected: {selectedFile.name}
                    </p>
                )}

                <button
                    className="knowledge-upload-button"
                    type="submit"
                    disabled={uploading || !selectedFile}
                >
                    {uploading ? "Uploading document..." : "↑ Upload document"}
                </button>

                {message && (
                    <p
                        className={`knowledge-upload-message ${message.includes("successfully") ? "success" : "error"
                            }`}
                        role="status"
                        aria-live="polite"
                    >
                        {message}
                    </p>
                )}
            </form>
        </section>
    );
}
