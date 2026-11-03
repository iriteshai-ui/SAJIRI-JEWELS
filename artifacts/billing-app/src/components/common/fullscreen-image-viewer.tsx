import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Sparkles,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Strips resizing, width clamping, and downscale parameters
 * to request the master original high-resolution image asset.
 */
export function getOriginalHighResImageUrl(url: string): string {
  if (!url) return "";
  try {
    let clean = url.trim();

    // Shopify CDN: strip size tokens like _1024x1024, _grande, _master before extension
    if (clean.includes("cdn.shopify.com")) {
      clean = clean.replace(
        /_(?:pico|icon|thumb|small|compact|medium|large|grande|1024x1024|2048x2048|master)(?=\.[a-zA-Z0-9]+(?:\?|$))/i,
        ""
      );
      // Remove width/height/crop URL query parameters that reduce resolution
      if (clean.includes("?")) {
        const [base, qs] = clean.split("?");
        const params = new URLSearchParams(qs);
        params.delete("width");
        params.delete("height");
        params.delete("crop");
        const remaining = params.toString();
        clean = remaining ? `${base}?${remaining}` : base;
      }
      return clean;
    }

    // Unsplash or other standard image CDN
    if (clean.includes("images.unsplash.com")) {
      const u = new URL(clean);
      u.searchParams.delete("w");
      u.searchParams.delete("h");
      u.searchParams.delete("fit");
      u.searchParams.set("q", "100");
      return u.toString();
    }

    return clean;
  } catch {
    return url;
  }
}

export interface FullscreenImageViewerProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  initialIndex?: number;
  productTitle?: string;
  productPrice?: number;
  productCategory?: string;
}

export function FullscreenImageViewer({
  isOpen,
  onClose,
  images = [],
  initialIndex = 0,
  productTitle = "",
  productPrice,
  productCategory,
}: FullscreenImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Touch gesture tracking for mobile swipe & double-tap
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTapRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync initial index whenever modal opens or initialIndex changes
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.max(0, Math.min(initialIndex, Math.max(images.length - 1, 0))));
      setScale(1);
      setPosition({ x: 0, y: 0 });
      // Prevent background scrolling
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
    return undefined;
  }, [isOpen, initialIndex, images.length]);

  // Reset zoom & pan when switching images
  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleNext = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % images.length);
    resetZoom();
  }, [images.length, resetZoom]);

  const handlePrev = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    resetZoom();
  }, [images.length, resetZoom]);

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(Number((prev + 0.5).toFixed(1)), 4));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => {
      const next = Math.max(Number((prev - 0.5).toFixed(1)), 1);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const toggleZoom = useCallback(() => {
    setScale((prev) => {
      if (prev > 1) {
        setPosition({ x: 0, y: 0 });
        return 1;
      }
      return 2.5;
    });
  }, []);

  // Keyboard Navigation: Escape, ArrowLeft, ArrowRight, +, -, 0
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === "-") {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === "0" || e.key.toLowerCase() === "r") {
        e.preventDefault();
        resetZoom();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, handleNext, handlePrev, handleZoomIn, handleZoomOut, resetZoom]);

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  // Mouse Drag / Panning when zoomed in
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Mobile Touch Gestures: Swipe left/right, swipe down to close, pinch & double-tap
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const now = Date.now();
    // Double tap detector
    if (now - lastTapRef.current < 300) {
      toggleZoom();
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: now,
    };

    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.touches[0];

    // If zoomed in, pan around
    if (scale > 1 && isDragging) {
      setPosition({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y,
      });
      return;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (scale > 1) {
      setIsDragging(false);
      return;
    }

    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const deltaTime = Date.now() - touchStartRef.current.time;

    touchStartRef.current = null;

    // Detect quick swipe
    if (deltaTime < 500) {
      // Horizontal swipe (next / prev)
      if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        if (deltaX < 0) {
          handleNext();
        } else {
          handlePrev();
        }
        return;
      }

      // Vertical swipe down (close viewer)
      if (deltaY > 80 && Math.abs(deltaY) > Math.abs(deltaX) * 1.5) {
        onClose();
        return;
      }
    }
  };

  if (!isOpen || images.length === 0) return null;

  const currentRawUrl = images[currentIndex] || images[0];
  const highResUrl = getOriginalHighResImageUrl(currentRawUrl);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col bg-neutral-950/95 backdrop-blur-md text-white select-none transition-opacity animate-in fade-in duration-200"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Top Bar: Product Context & Viewer Controls ── */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/10 bg-black/40 backdrop-blur-md shrink-0 z-20">
        <div className="flex items-center gap-3 max-w-[65%] sm:max-w-[75%] truncate">
          <Badge
            variant="outline"
            className="hidden sm:inline-flex bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] font-semibold uppercase tracking-wider"
          >
            {productCategory || "Jewellery Piece"}
          </Badge>

          <div className="truncate">
            <h2 className="text-xs sm:text-sm font-serif font-bold text-neutral-100 truncate">
              {productTitle || "Exquisite Jewellery Showcase"}
            </h2>
            {productPrice !== undefined && (
              <p className="text-[11px] font-mono text-amber-400 font-semibold">
                ₹{productPrice.toLocaleString("en-IN")}
              </p>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Zoom In / Out Buttons */}
          <div className="flex items-center bg-white/10 rounded-full border border-white/10 p-0.5">
            <button
              onClick={handleZoomOut}
              disabled={scale <= 1}
              className="p-1.5 rounded-full hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-mono font-medium px-2 min-w-10 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              disabled={scale >= 4}
              className="p-1.5 rounded-full hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {scale > 1 && (
            <button
              onClick={resetZoom}
              className="hidden sm:flex items-center gap-1 text-[11px] bg-white/10 hover:bg-white/20 border border-white/10 rounded-full px-2.5 py-1 transition-colors"
              title="Reset Zoom (0 or R)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 hover:text-amber-400 border border-white/10 transition-colors ml-1"
            title="Close Viewer (Esc)"
            data-testid="button-close-fullscreen-viewer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ── Main Viewport: Highest-Resolution Image with Preserved Aspect Ratio ── */}
      <main
        className="flex-1 relative flex items-center justify-center overflow-hidden p-4 sm:p-8"
        onMouseDown={handleMouseDown}
        style={{ cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
      >
        {/* Next / Previous Overlay Buttons */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 p-2.5 sm:p-3.5 rounded-full bg-black/60 hover:bg-black/85 text-white/90 hover:text-amber-400 border border-white/15 backdrop-blur-md shadow-2xl transition-all z-20 hover:scale-105 active:scale-95"
              title="Previous Photo (←)"
              data-testid="button-prev-image"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 p-2.5 sm:p-3.5 rounded-full bg-black/60 hover:bg-black/85 text-white/90 hover:text-amber-400 border border-white/15 backdrop-blur-md shadow-2xl transition-all z-20 hover:scale-105 active:scale-95"
              title="Next Photo (→)"
              data-testid="button-next-image"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Central High-Resolution Image Container */}
        <div
          className="relative max-w-full max-h-full flex items-center justify-center transition-transform duration-100 ease-out"
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
            transformOrigin: "center center",
          }}
          onDoubleClick={toggleZoom}
        >
          <img
            src={highResUrl}
            alt={`${productTitle} - high resolution view`}
            className="max-w-[92vw] max-h-[76vh] object-contain select-none pointer-events-auto rounded-lg shadow-2xl"
            style={{
              aspectRatio: "auto",
              filter: "drop-shadow(0 10px 30px rgba(0,0,0,0.6))",
            }}
            draggable={false}
          />
        </div>

        {/* Image Index Pill */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-mono font-medium text-white/80 border border-white/15 shadow-md pointer-events-none">
          {currentIndex + 1} / {images.length}
        </div>
      </main>

      {/* ── Bottom Bar: Thumbnails & Keyboard Guide ── */}
      <footer className="px-4 py-3 bg-black/50 backdrop-blur-md border-t border-white/10 shrink-0 z-20 flex flex-col items-center gap-2">
        {/* Thumbnails Strip */}
        {images.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1 scrollbar-none">
            {images.map((img, idx) => {
              const isSelected = currentIndex === idx;
              return (
                <button
                  key={idx}
                  onClick={() => {
                    setCurrentIndex(idx);
                    resetZoom();
                  }}
                  className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                    isSelected
                      ? "border-amber-400 scale-105 shadow-md shadow-amber-500/20"
                      : "border-white/20 opacity-50 hover:opacity-100 hover:border-white/50"
                  }`}
                  title={`View image ${idx + 1}`}
                >
                  <img
                    src={img}
                    alt={`Thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              );
            })}
          </div>
        )}

        {/* Helpful Keyboard & Gesture Hints */}
        <div className="text-[10px] text-white/60 flex items-center gap-3 flex-wrap justify-center font-light">
          <span>
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[9px] font-mono mr-1">Esc</kbd>
            Close
          </span>
          <span>•</span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[9px] font-mono mr-1">←</kbd>
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[9px] font-mono mr-1">→</kbd>
            Navigate
          </span>
          <span>•</span>
          <span>Scroll or double-tap to zoom</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[9px] font-mono mr-1">+</kbd>
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[9px] font-mono mr-1">-</kbd>
            Zoom
          </span>
        </div>
      </footer>
    </div>
  );
}

