import React from 'react';
import { IntelPropertyRow } from './IntelPropertyRow';

interface LongTextPropertyProps {
    label: string;
    text: string;
    classNamePrefix?: string;
}

export function LongTextProperty({ label, text, classNamePrefix = "intel-panel" }: LongTextPropertyProps) {
    // If it's a known summary block, we might want it to have a specific height,
    // otherwise just let it be pre-wrap.
    const isSummary = label.toLowerCase() === "summary" || label.toLowerCase() === "description";

    return (
        <IntelPropertyRow label={label} isColumn={true} classNamePrefix={classNamePrefix}>
            <div 
                style={{ 
                    maxHeight: isSummary ? "150px" : "auto", 
                    width: "100%", 
                    overflowY: isSummary ? "auto" : "visible", 
                    whiteSpace: "pre-wrap", 
                    paddingRight: "var(--space-xs)", 
                    lineHeight: "1.4",
                    wordBreak: "break-word"
                }}
            >
                {text}
            </div>
        </IntelPropertyRow>
    );
}
