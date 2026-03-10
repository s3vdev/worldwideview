"use client";

import React, { ChangeEvent } from "react";
import { inputGroupStyle, labelStyle, inputStyle, loadButtonStyle } from "./cameraSettingsStyles";

interface InsecamSectionProps {
    settings: any;
    isLoading: boolean;
    onCategoryChange: (e: ChangeEvent<HTMLSelectElement>) => void;
    onLoad: () => void;
}

export const InsecamSection: React.FC<InsecamSectionProps> = ({
    settings, isLoading, onCategoryChange, onLoad,
}) => (
    <div style={inputGroupStyle}>
        <label style={labelStyle}>Category</label>
        <select value={settings.insecamCategory || ""} onChange={onCategoryChange} style={{ ...inputStyle, width: "100%", marginTop: "4px" }}>
            <option value="">Select Category</option>
            <option value="rating">Highest Rated</option>
            <option value="new">Newest</option>
        </select>
        <button onClick={onLoad} disabled={!settings.insecamCategory || isLoading} style={{ ...loadButtonStyle(!settings.insecamCategory || isLoading), marginTop: "var(--space-sm)" }}>
            {isLoading ? "Loading..." : "Load"}
        </button>
    </div>
);
