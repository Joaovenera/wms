
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, Camera, Flashlight, Type, RotateCcw } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { TouchOptimizedButton } from "./mobile/TouchOptimizedControls";
import "./qr-scanner.css";

interface QrScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export default function QrScanner({ onScan, onClose }: QrScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [hasFlash, setHasFlash] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [html5QrCode, setHtml5QrCode] = useState<Html5Qrcode | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [cameras, setCameras] = useState<{ id: string; label?: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [viewportKey, setViewportKey] = useState(0);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const qrDbgEnabled =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("qrdebug") === "1";

  const applyVideoAdjustments = () => {
    try {
      const container = scannerRef.current;
      const v = container?.querySelector("video") as HTMLVideoElement | null;
      if (!container || !v) return;

      const intrinsicW = v.videoWidth;
      const intrinsicH = v.videoHeight;
      if (!intrinsicW || !intrinsicH) return;
      const intrinsicRatio = intrinsicW / intrinsicH;

      const rect = v.getBoundingClientRect();
      const displayW = rect.width || v.clientWidth || 0;
      const displayH = rect.height || v.clientHeight || 0;
      const displayRatio = displayH ? displayW / displayH : intrinsicRatio;

      container.style.setProperty("--qr-aspect", String(intrinsicRatio));

      console.debug("[QR] adjust", {
        intrinsicW,
        intrinsicH,
        intrinsicRatio,
        displayW,
        displayH,
        displayRatio,
        screenOrientation: (screen as any)?.orientation?.type,
      });

      const deviceIsPortrait = window.innerHeight > window.innerWidth;
      const streamIsLandscape = intrinsicRatio > 1.3;

      const tolerance = 0.08;
      const browserAlreadyRotated =
        Math.abs(displayRatio - 1 / intrinsicRatio) < tolerance;

      if (streamIsLandscape && deviceIsPortrait && !browserAlreadyRotated) {
        container.setAttribute("data-rotate", "90");
        container.removeAttribute("data-fit");
      } else {
        container.removeAttribute("data-rotate");

        if (streamIsLandscape && deviceIsPortrait) {
          if (!browserAlreadyRotated) container.setAttribute("data-fit", "cover");
          else container.removeAttribute("data-fit");
        } else {
          container.removeAttribute("data-fit");
        }
      }
    } catch (err) {
      console.debug("[QR] applyVideoAdjustments error", err);
    }
  };

  useEffect(() => {
    let restoreDebug: (() => void) | null = null;
    if (qrDbgEnabled) {
      const el = document.createElement("div");
      el.id = "qr-debug-overlay";
      el.style.position = "fixed";
      el.style.bottom = "0";
      el.style.left = "0";
      el.style.right = "0";
      el.style.maxHeight = "40%";
      el.style.overflow = "auto";
      el.style.background = "rgba(0,0,0,0.8)";
      el.style.color = "#0ef";
      el.style.font = "12px/1.4 monospace";
      el.style.padding = "8px 8px 28px 8px";
      el.style.zIndex = "2147483647";
      const bar = document.createElement("div");
      bar.style.position = "sticky";
      bar.style.bottom = "0";
      bar.style.left = "0";
      bar.style.right = "0";
      bar.style.display = "flex";
      bar.style.gap = "8px";
      bar.style.background = "rgba(0,0,0,0.9)";
      const btnClear = document.createElement("button");
      btnClear.textContent = "Limpar";
      btnClear.style.padding = "4px 8px";
      btnClear.onclick = () => {
        el.querySelectorAll(".qr-log").forEach((n) => n.remove());
      };
      const btnClose = document.createElement("button");
      btnClose.textContent = "Fechar";
      btnClose.style.padding = "4px 8px";
      btnClose.onclick = () => {
        el.remove();
      };
      bar.appendChild(btnClear);
      bar.appendChild(btnClose);
      document.body.appendChild(el);
      el.appendChild(bar);
      overlayRef.current = el;
      const orig = console.debug.bind(console);
      (console as any).debug = (...args: any[]) => {
        try {
          orig(...args);
          const first = args[0];
          if (typeof first === "string" && first.startsWith("[QR]") && overlayRef.current) {
            const line = document.createElement("div");
            line.className = "qr-log";
            const time = new Date().toISOString().split("T")[1].slice(0, 12);
            const text = args
              .map((a) => {
                if (typeof a === "string") return a;
                try {
                  return JSON.stringify(a);
                } catch {
                  return String(a);
                }
              })
              .join(" ");
            line.textContent = `[${time}] ${text}`;
            overlayRef.current.appendChild(line);
            overlayRef.current.scrollTop = overlayRef.current.scrollHeight;
          }
        } catch {
          /* noop */
        }
      };
      restoreDebug = () => {
        (console as any).debug = orig;
      };
    }

    let cancelled = false;
    let activeInstance: Html5Qrcode | null = null;

    const start = async () => {
      try {
        setError(null);
        setIsActive(false);
        console.debug("[QR] start() – desired", {
          facingMode,
          selectedCameraId,
          viewport: { w: window.innerWidth, h: window.innerHeight },
        });

        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          stream.getTracks().forEach((t) => t.stop());
        } catch (_) {}

        if (!scannerRef.current) return;

        // enumerate cameras robustly
        let videoInputs: { id: string; label?: string }[] = [];
        try {
          const list = await (Html5Qrcode as any).getCameras();
          if (Array.isArray(list) && list.length) {
            videoInputs = list.map((d: any) => ({ id: d.id, label: d.label || "" }));
            console.debug("[QR] html5-qrcode getCameras result", videoInputs);
          } else {
            console.debug("[QR] html5-qrcode getCameras empty or non-array", list);
          }
        } catch (err) {
          console.debug("[QR] html5-qrcode getCameras failed", err);
        }

        if (!videoInputs.length) {
          try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            videoInputs = devices
              .filter((d) => d.kind === "videoinput")
              .map((d) => ({ id: (d as MediaDeviceInfo).deviceId, label: (d as MediaDeviceInfo).label || "" }));
            console.debug("[QR] enumerateDevices videoInputs", videoInputs);
          } catch (err) {
            console.debug("[QR] enumerateDevices failed", err);
          }
        }

        setCameras(videoInputs);

        if (videoInputs.length && !selectedCameraId) {
          const pickBestBackCamera = async (devices: { id: string; label?: string }[]) => {
            const backCandidates = devices.filter((d) =>
              /back|trás|rear|environment|outward/i.test(d.label || "")
            );
            const candidates = backCandidates.length ? backCandidates : devices;
            const preferred = candidates.find((d) =>
              /(?:main|wide|1x|default|rear\s?wide|wide-angle)/i.test(d.label || "")
            );
            if (preferred) return preferred;

            const badRe = /ultra[- ]?wide|ultrawide|0\.?5x|0,5x|0-5x|0_5x|macro|tele|depth|tof|wideangle|fisheye/i;
            const filtered = candidates.filter((d) => !badRe.test(d.label || ""));
            if (filtered.length) return filtered[0];

            let best: { id: string; label?: string } | null = null;
            let bestWidth = 0;
            for (const dev of candidates) {
              try {
                const s = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: dev.id } } });
                const track = s.getVideoTracks()[0];
                const settings: any = (track.getSettings && track.getSettings()) || {};
                const w = settings.width || 0;
                track.stop();
                console.debug("[QR] probe device", dev.label, "-> width", w);
                if (w > bestWidth) {
                  bestWidth = w;
                  best = dev;
                }
              } catch (err) {
                console.debug("[QR] probe device failed", dev, err);
              }
            }
            if (best) return best;
            return candidates[0];
          };

          try {
            const best = await pickBestBackCamera(videoInputs);
            if (best) {
              setSelectedCameraId(best.id);
              console.debug("[QR] selected camera (heuristic)", best);
            } else {
              setSelectedCameraId(videoInputs[0].id);
              console.debug("[QR] selected camera (fallback)", videoInputs[0]);
            }
          } catch (err) {
            console.debug("[QR] pickBestBackCamera failed", err);
            setSelectedCameraId(videoInputs[0].id);
          }
        }

        const cameraIdToUse = selectedCameraId ? selectedCameraId : undefined;
        console.debug("[QR] cameraIdToUse", cameraIdToUse || "(facingMode)");

        let computedFps = 10;
        try {
          const probe = await navigator.mediaDevices.getUserMedia({
            video: cameraIdToUse ? { deviceId: { exact: cameraIdToUse } } : { facingMode },
            audio: false,
          });
          const track = probe.getVideoTracks()[0];
          const settings: any = track.getSettings?.() || {};
          const maxDim = Math.max(settings.width || 0, settings.height || 0);
          track.stop();

          let nextFps = 10;
          if (maxDim >= 3000) nextFps = 20;
          else if (maxDim >= 1920) nextFps = 15;
          else if (maxDim >= 1280) nextFps = 12;
          computedFps = nextFps;
          console.debug("[QR] stream settings probe", { settings, computedFps });
        } catch (err) {
          console.debug("[QR] probe failed – fallback", err);
          computedFps = 10;
        }

        const instance = new Html5Qrcode(scannerRef.current.id, false);
        activeInstance = instance;
        if (cancelled) return;
        setHtml5QrCode(instance);

        const vpW = Math.max(360, window.innerWidth);
        const vpH = Math.max(640, window.innerHeight);
        const isPortrait = vpH >= vpW;
        const qualityConstraints = isPortrait
          ? { width: { ideal: 1080, min: 720 }, height: { ideal: 1920, min: 1280 }, aspectRatio: { ideal: 9 / 16 } }
          : { width: { ideal: 1920, min: 1280 }, height: { ideal: 1080, min: 720 }, aspectRatio: { ideal: 16 / 9 } };
        const baseConstraints = cameraIdToUse
          ? { deviceId: { exact: cameraIdToUse }, ...qualityConstraints }
          : { facingMode, ...qualityConstraints };

        const config: any = {
          fps: computedFps,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const size = Math.floor(minEdge * 0.65);
            return { width: size, height: size } as any;
          },
          videoConstraints: baseConstraints,
        };

        let cameraConfig: any;
        if (cameraIdToUse) {
          const cam = (cameras || []).find((c) => c.id === cameraIdToUse);
          const isFrontLabel = cam && /front|user/i.test(cam.label || "");
          const isBackLabel = cam && /back|trás|rear|environment|outward/i.test(cam.label || "");
          if ((facingMode === "environment" && isFrontLabel) || (facingMode === "user" && isBackLabel)) {
            cameraConfig = { facingMode };
            console.debug("[QR] cameraConfig override to facingMode due to label mismatch", { desired: facingMode, cam });
          } else {
            cameraConfig = cameraIdToUse;
          }
        } else {
          cameraConfig = { facingMode };
        }

        console.debug("[QR] start config", { cameraConfig, config, vpW, vpH });
        await instance.start(
          cameraConfig as any,
          config,
          (decodedText: string) => {
            onScan(decodedText);
            instance.stop().then(() => instance.clear()).catch(() => {});
            setIsActive(false);
          },
          () => {}
        );

        console.debug("[QR] started");

        const setupAdjust = () => {
          setTimeout(() => applyVideoAdjustments(), 150);
        };

        const videoEl = scannerRef.current.querySelector("video") as HTMLVideoElement | null;
        if (videoEl) {
          videoEl.addEventListener("loadedmetadata", setupAdjust);
        }

        window.addEventListener("resize", applyVideoAdjustments);
        window.addEventListener("orientationchange", applyVideoAdjustments);

        setTimeout(() => applyVideoAdjustments(), 300);

        try {
          const test = await navigator.mediaDevices.getUserMedia({
            video: cameraIdToUse ? { deviceId: { exact: cameraIdToUse } } : { facingMode },
            audio: false,
          });
          const t = test.getVideoTracks()[0];
          const caps: any = (t.getCapabilities && t.getCapabilities()) || {};
          setHasFlash(!!caps.torch);
          const s: any = t.getSettings ? t.getSettings() : {};
          const w = s.width || vpW;
          const h = s.height || vpH;
          const ratio = w && h ? w / h : undefined;
          if (ratio && scannerRef.current) scannerRef.current.style.setProperty("--qr-aspect", String(ratio));
          t.stop();
        } catch (err) {
          setHasFlash(false);
        }

        setIsActive(true);
      } catch (e) {
        console.error("Failed to start QR scanner:", e);
        setError("Não foi possível iniciar a câmera. Verifique as permissões do navegador.");
      }
    };

    start();

    return () => {
      cancelled = true;
      console.debug("[QR] cleanup stop/clear");
      html5QrCode?.stop().then(() => html5QrCode?.clear()).catch((err) => console.debug("[QR] cleanup error", err));
      if (restoreDebug) restoreDebug();
      window.removeEventListener("resize", applyVideoAdjustments);
      window.removeEventListener("orientationchange", applyVideoAdjustments);
    };
  }, [onScan, facingMode, selectedCameraId, viewportKey]);

  useEffect(() => {
    const handleResize = () => {
      console.debug("[QR] viewport change", { w: window.innerWidth, h: window.innerHeight, orientation: (screen as any)?.orientation?.type });
      setViewportKey((prev) => prev + 1);
    };
    window.addEventListener("orientationchange", handleResize);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("orientationchange", handleResize);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      onClose();
    }
  };

  const toggleFlash = async () => {
    if (!html5QrCode) return;
    try {
      await (html5QrCode as any).applyVideoConstraints({ advanced: [{ torch: !flashOn }] });
      setFlashOn(!flashOn);
    } catch (err) {
      console.error("Failed to toggle flash", err);
      setError("Não foi possível controlar o flash.");
    }
  };

  const switchCamera = async () => {
    if (!html5QrCode) return;
    try {
      try { await html5QrCode.stop(); } catch {}
      try { await html5QrCode.clear(); } catch {}
      if (cameras.length > 1) {
        const currentIdx = Math.max(0, cameras.findIndex((c) => c.id === selectedCameraId));
        const nextIdx = (currentIdx + 1) % cameras.length;
        if (cameras[nextIdx]?.id && cameras[nextIdx].id !== selectedCameraId) {
          setSelectedCameraId(cameras[nextIdx].id);
        } else setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
      } else setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
    } catch (err) {
      console.error("Failed to switch camera", err);
      setError("Não foi possível trocar de câmera.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 text-white bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <h2 className="text-lg font-medium">Scanner QR Code</h2>
        </div>
        <TouchOptimizedButton
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-white hover:bg-white/20 p-2"
          hapticFeedback={true}
        >
          <X className="h-6 w-6" />
        </TouchOptimizedButton>
      </div>

      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {!showManualInput && (
          <div id="qr-reader" ref={scannerRef} className="absolute inset-0 w-full h-full"></div>
        )}

        {!isActive && !showManualInput && (
          <div className="absolute inset-0 flex items-center justify-center h-full text-white bg-black/70">
            <div className="text-center">
              <Camera className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Iniciando câmera...</p>
              {error && (
                <div className="mt-4 space-y-2">
                  <p className="text-red-300 text-sm">{error}</p>
                  <Button
                    onClick={() => setShowManualInput(true)}
                    variant="outline"
                    className="text-white border-white hover:bg-white/20"
                  >
                    <Type className="h-4 w-4 mr-2" />
                    Digitar código
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {showManualInput && (
          <div className="flex items-center justify-center h-full text-white p-6">
            <div className="text-center space-y-4 w-full max-w-md">
              <Type className="h-16 w-16 mx-auto mb-4 opacity-75" />
              <h3 className="text-xl font-medium">Digite o código</h3>
              <p className="text-sm opacity-75">Insira o código da UCP, pallet ou posição manualmente</p>

              <div className="space-y-3">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Ex: UCP-20250623-0001"
                  className="w-full px-4 py-3 text-black rounded-lg text-center font-mono text-lg"
                  autoFocus
                  onKeyPress={(e) => { if (e.key === "Enter") handleManualSubmit(); }}
                />

                <div className="flex space-x-2">
                  <Button
                    onClick={() => { setShowManualInput(false); setError(null); setFacingMode((p) => p); }}
                    variant="outline"
                    className="flex-1 text-white border-white hover:bg-white/20"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Tentar câmera
                  </Button>
                  <Button
                    onClick={handleManualSubmit}
                    disabled={!manualCode.trim()}
                    className="flex-1 bg-primary hover:bg-primary/90"
                  >
                    Confirmar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 space-y-4 relative z-10">
        <div className="flex justify-center space-x-2">
          {isActive && hasFlash && (
            <Button
              variant="outline"
              size="lg"
              onClick={toggleFlash}
              className={`text-white border-white ${flashOn ? "bg-white/20" : "bg-transparent"} hover:bg.white/30`}
            >
              <Flashlight className="h-6 w-6" />
            </Button>
          )}

          {isActive && (
            <Button
              variant="outline"
              size="lg"
              onClick={switchCamera}
              className="text-white border-white bg-transparent hover:bg-white/30"
            >
              <RotateCcw className="h-6 w-6" />
            </Button>
          )}

          <Button variant="outline" size="lg" onClick={() => setShowManualInput(true)} className="text-white border-white bg-transparent hover:bg-white/30">
            <Type className="h-6 w-6 mr-2" />
            Digitar
          </Button>
        </div>

        {!isActive && !showManualInput && (
          <Card className="bg-white/10 border-white/20">
            <CardContent className="p-3">
              <p className="text-white text-sm text-center">Use o botão Digitar para inserir códigos manualmente ou aguarde a câmera carregar</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
