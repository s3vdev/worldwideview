import { useState, useEffect } from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Returns true when viewport width is ≤ 768px.
 * Listens to matchMedia so it reacts to resize / orientation changes.
 */
export function useIsMobile(): boolean {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

        const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
            setIsMobile(e.matches);
        };

        handleChange(mql);
        mql.addEventListener("change", handleChange);
        return () => mql.removeEventListener("change", handleChange);
    }, []);

    return isMobile;
}
