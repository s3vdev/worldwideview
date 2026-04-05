import React from 'react';
import { ExternalLink } from 'lucide-react';

interface UrlPropertyProps {
    label: string;
    url: string;
    classNamePrefix?: string;
}

export function UrlProperty({ label, url, classNamePrefix = "intel-panel" }: UrlPropertyProps) {
    return (
        <div style={{ display: "flex", flexDirection: "column", marginTop: "var(--space-md)", paddingTop: "var(--space-sm)", borderTop: "1px solid rgba(255,255,255,0.05)", minWidth: 0 }}>
            <span className={`${classNamePrefix}__prop-key`} style={{ marginBottom: 6 }}>
                {label}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", width: "100%" }}>
                <div 
                    style={{ 
                        flex: 1, 
                        overflowX: "auto", 
                        whiteSpace: "nowrap",
                        fontSize: 13,
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-primary)",
                        paddingBottom: 2
                    }}
                >
                    {url}
                </div>
                <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-cyan)", display: "flex", flexShrink: 0 }} title="Open Link">
                    <ExternalLink size={14} />
                </a>
            </div>
        </div>
    );
}
