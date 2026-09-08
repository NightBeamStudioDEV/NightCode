import {
  useLayoutEffect,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

export function ModelPopover({
  anchor,
  children,
}: {
  anchor: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
}) {
  const [position, setPosition] = useState<CSSProperties>({
    visibility: "hidden",
  });
  useLayoutEffect(() => {
    const button = anchor.current;
    if (!button) return;
    const update = () => {
      const rect = button.getBoundingClientRect();
      const viewport = window.visualViewport;
      const width = viewport?.width || window.innerWidth;
      const height = viewport?.height || window.innerHeight;
      const x = viewport?.offsetLeft || 0;
      const y = viewport?.offsetTop || 0;
      const toolbar =
        document.querySelector(".workspace-toolbar")?.getBoundingClientRect()
          .bottom || 0;
      const topEdge = Math.max(y + 12, toolbar + 8);
      const bottomEdge = y + height - 12;
      const above = Math.max(0, rect.top - 8 - topEdge);
      const below = Math.max(0, bottomEdge - rect.bottom - 8);
      const placeAbove = above >= 300 || above >= below;
      const panelWidth = Math.min(340, width - 24);
      setPosition({
        position: "fixed",
        width: panelWidth,
        left: Math.max(
          x + 12,
          Math.min(rect.right - panelWidth, x + width - panelWidth - 12),
        ),
        right: "auto",
        top: placeAbove ? "auto" : rect.bottom + 8,
        bottom: placeAbove ? window.innerHeight - rect.top + 8 : "auto",
        maxHeight: Math.min(560, placeAbove ? above : below),
        transformOrigin: placeAbove ? "bottom right" : "top right",
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(button);
    const pane = button.closest(".main-pane");
    if (pane) observer.observe(pane);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, [anchor]);
  return createPortal(
    <div
      id="model-picker"
      data-compact={Number(position.maxHeight) < 420}
      className="dropdown models"
      style={position}
      aria-label="Model and reasoning"
    >
      {children}
    </div>,
    document.body,
  );
}
