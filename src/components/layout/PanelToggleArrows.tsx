"use client";

import { useStore } from "@/core/state/store";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { useIsMobile } from "@/core/hooks/useIsMobile";

export function PanelToggleArrows() {
    const isMobile = useIsMobile();
    const leftSidebarOpen = useStore((s) => s.leftSidebarOpen);
    const configPanelOpen = useStore((s) => s.configPanelOpen);
    const openMobilePanel = useStore((s) => s.openMobilePanel);

    const toggleLeftSidebar = useStore((s) => s.toggleLeftSidebar);
    const toggleConfigPanel = useStore((s) => s.toggleConfigPanel);
    const setOpenMobilePanel = useStore((s) => s.setOpenMobilePanel);

    const filterCount = useStore((s) =>
        Object.values(s.filters).reduce((sum, pf) => sum + Object.keys(pf).length, 0)
    );

    const handleLeftToggle = () => {
        if (isMobile) setOpenMobilePanel("left");
        else toggleLeftSidebar();
    };

    const handleRightToggle = () => {
        if (isMobile) setOpenMobilePanel("right");
        else toggleConfigPanel();
    };

    const isLeftOpen = isMobile ? openMobilePanel === "left" : leftSidebarOpen;
    const isRightOpen = isMobile ? openMobilePanel === "right" : configPanelOpen;

    return (
        <>
            <button
                className={`panel-toggle-btn panel-toggle-btn--left ${isLeftOpen ? "panel-toggle-btn--open" : ""} ${isMobile ? "panel-toggle-btn--mobile" : ""}`}
                onClick={handleLeftToggle}
                title="Toggle Layers Panel"
            >
                {isLeftOpen ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
            </button>

            <button
                className={`panel-toggle-btn panel-toggle-btn--right ${isRightOpen ? "panel-toggle-btn--open" : ""} ${isMobile ? "panel-toggle-btn--mobile" : ""}`}
                onClick={handleRightToggle}
                title="Toggle Data Configuration"
            >
                {isRightOpen ? <ChevronRight size={24} /> : <ChevronLeft size={24} />}
                {filterCount > 0 && !isRightOpen && (
                    <span className="filter-badge filter-badge--toggle">
                        {filterCount}
                    </span>
                )}
            </button>
        </>
    );
}
