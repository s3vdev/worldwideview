import React, { useState } from 'react';
import { IntelPropertyRow } from './IntelPropertyRow';

interface TimestampPropertyProps {
    timestamp: string | number | Date;
    classNamePrefix?: string;
}

export function TimestampProperty({ timestamp, classNamePrefix = "intel-panel" }: TimestampPropertyProps) {
    const [showUtc, setShowUtc] = useState(false);
    return (
        <IntelPropertyRow label="Timestamp" isColumn={true} classNamePrefix={classNamePrefix}>
            <span 
                style={{ cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: "2px", width: "100%" }}
                onClick={() => setShowUtc(!showUtc)}
                title="Click to view UTC time"
            >
                {new Date(timestamp).toLocaleString(undefined, {
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZoneName: 'short'
                })}
            </span>
            {showUtc && (
                <span style={{ fontSize: "0.85em", color: "var(--text-muted)", width: "100%" }}>
                    {new Date(timestamp).toUTCString()}
                </span>
            )}
        </IntelPropertyRow>
    );
}
