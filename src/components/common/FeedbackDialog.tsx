"use client";

import React, { useState } from "react";
import { X, Paperclip } from "lucide-react";
import { useStore } from "@/core/state/store";
import styles from "./FeedbackDialog.module.css";
import { trackEvent } from "@/lib/analytics";

export function FeedbackDialog() {
    const feedbackDialogOpen = useStore((s) => s.feedbackDialogOpen);
    const setFeedbackDialogOpen = useStore((s) => s.setFeedbackDialogOpen);

    const [type, setType] = useState("Bug Report");
    const [description, setDescription] = useState("");
    const [steps, setSteps] = useState("");
    const [attachLogs, setAttachLogs] = useState(true);
    const [sendAsEmail, setSendAsEmail] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!feedbackDialogOpen) return null;

    const isFormValid = description.length >= 10;

    const handleSubmit = async () => {
        if (!isFormValid) return;
        
        setIsSubmitting(true);
        try {
            const payload = {
                type,
                description,
                steps,
                attachLogs,
                sendAsEmail,
                timestamp: new Date().toISOString(),
            };

            await fetch("https://n8n.arfquant.com/webhook-test/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            trackEvent("submit-feedback", { type });

            // Reset state
            setDescription("");
            setSteps("");
            setType("Bug Report");
            setFeedbackDialogOpen(false);
        } catch (error) {
            console.error("Failed to submit feedback:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={() => setFeedbackDialogOpen(false)}>
            <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.title}>Provide Feedback</div>
                    <button className={styles.closeButton} onClick={() => setFeedbackDialogOpen(false)}>
                        <X size={18} />
                    </button>
                </div>

                <div className={styles.content}>
                    <div className={styles.section}>
                        <div className={styles.label}>Feedback Type</div>
                        <div className={styles.radioGroup}>
                            {["Bug Report", "Feature Request", "Auth and Billing", "General Feedback"].map((opt) => (
                                <label key={opt} className={styles.radioOption}>
                                    <input
                                        type="radio"
                                        name="feedbackType"
                                        value={opt}
                                        checked={type === opt}
                                        onChange={(e) => setType(e.target.value)}
                                        className={styles.radioInput}
                                    />
                                    <span className={styles.radioLabel}>{opt}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className={styles.section}>
                        <div className={styles.label}>Description</div>
                        <div className={styles.description}>
                            Please describe the issue in detail. The more actionable your feedback, the quicker our team can address your request. Some helpful information includes:
                            <ul className={styles.descriptionList}>
                                <li>Steps to reproduce the issue</li>
                                <li>Expected behavior</li>
                                <li>Actual behavior</li>
                                <li>Any error messages</li>
                                <li>Any relevant information</li>
                            </ul>
                        </div>
                        <div className={styles.textareaContainer}>
                            <textarea
                                className={styles.textarea}
                                placeholder="Describe the bug you encountered..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                            <div className={`${styles.charCount} ${isFormValid ? styles.valid : ""}`}>
                                {description.length}/50
                            </div>
                        </div>
                    </div>

                    <div className={styles.section}>
                        <div className={styles.label}>Steps to Reproduce</div>
                        <div className={styles.textareaContainer}>
                            <textarea
                                className={styles.textarea}
                                placeholder="Please list the steps to reproduce the issue"
                                value={steps}
                                onChange={(e) => setSteps(e.target.value)}
                                style={{ minHeight: "80px" }}
                            />
                        </div>
                    </div>

                    <div className={styles.checkboxGroup}>
                        <button className={styles.attachAction}>
                            <Paperclip size={16} />
                            <span>Attach a screenshot (optional)</span>
                        </button>

                        <label className={styles.checkboxOption}>
                            <input
                                type="checkbox"
                                checked={attachLogs}
                                onChange={(e) => setAttachLogs(e.target.checked)}
                                className={styles.checkboxInput}
                            />
                            <span className={styles.checkboxLabel}>Attach Antigravity server logs</span>
                        </label>

                        <label className={styles.checkboxOption}>
                            <input
                                type="checkbox"
                                checked={sendAsEmail}
                                onChange={(e) => setSendAsEmail(e.target.checked)}
                                className={styles.checkboxInput}
                            />
                            <span className={styles.checkboxLabel}>Send feedback as user@example.com</span>
                        </label>
                    </div>
                </div>

                <div className={styles.footer}>
                    <button 
                        className={`${styles.submitButton} ${isSubmitting ? styles.submitting : ""} ${isFormValid ? styles.enabled : ""}`} 
                        onClick={handleSubmit}
                        disabled={isSubmitting || !isFormValid}
                    >
                        {isSubmitting ? "Submitting..." : "Submit"}
                    </button>
                </div>
            </div>
        </div>
    );
}
