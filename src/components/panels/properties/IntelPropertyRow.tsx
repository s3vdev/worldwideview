import React from 'react';

interface IntelPropertyRowProps {
    label: string;
    isColumn?: boolean;
    classNamePrefix?: string;
    children: React.ReactNode;
}

export function IntelPropertyRow({
    label,
    isColumn,
    classNamePrefix = "intel-panel",
    children
}: IntelPropertyRowProps) {
    if (isColumn) {
        return (
            <div className={`${classNamePrefix}__prop`} style={{ flexDirection: "column", alignItems: "flex-start", gap: "var(--space-xs)" }}>
                <span className={`${classNamePrefix}__prop-key`}>{label}</span>
                <div className={`${classNamePrefix}__prop-value`} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "4px", width: "100%" }}>
                    {children}
                </div>
            </div>
        );
    }

    return (
        <div className={`${classNamePrefix}__prop`}>
            <span className={`${classNamePrefix}__prop-key`}>{label}</span>
            <span className={`${classNamePrefix}__prop-value`}>{children}</span>
        </div>
    );
}
