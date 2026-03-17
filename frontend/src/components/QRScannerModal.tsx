import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { workspacePrimaryButtonClassName } from "@/components/workspace/workspaceTheme";
import { Camera, ImageUp, QrCode, Search } from "lucide-react";

interface QRScannerModalProps {
  onPatientFound: (nhsId: string) => void;
  trigger?: React.ReactNode;
}

interface DetectedBarcode {
  rawValue?: string;
}

interface BarcodeDetectorInstance {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance;
  getSupportedFormats?: () => Promise<string[]>;
}

function getBarcodeDetector(): BarcodeDetectorConstructor | null {
  const detector = (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
  return detector ?? null;
}

function formatNhsId(digits: string): string {
  return `NHS-${digits}`;
}

function extractNhsId(rawValue: string): string {
  const compactMatch = rawValue.match(/\bNHS-(\d{6,16})\b/i);
  if (compactMatch) {
    return formatNhsId(compactMatch[1]);
  }

  const spacedMatch = rawValue.match(/\bNHS[:\s-]+(\d{6,16})\b/i);
  if (spacedMatch) {
    return formatNhsId(spacedMatch[1]);
  }

  const digitsOnlyMatch = rawValue.match(/^\d{6,16}$/);
  if (digitsOnlyMatch) {
    return formatNhsId(digitsOnlyMatch[0]);
  }

  return "";
}

function normalizeNhsValue(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return "";
  }

  const directMatch = extractNhsId(trimmed);
  if (directMatch) {
    return directMatch;
  }

  if (/^[\[{]/.test(trimmed)) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      for (const key of ["nhsHealthcareId", "nhs_healthcare_id", "nhsId", "nhs_id", "id"]) {
        const value = parsed[key];
        if (typeof value === "string") {
          const extracted = extractNhsId(value.trim());
          if (extracted) {
            return extracted;
          }
        }
      }
    } catch {
      // Ignore invalid JSON payloads and fall back to text parsing below.
    }
  }

  try {
    const url = new URL(trimmed);
    for (const key of ["nhs", "nhsId", "nhs_id", "nhsHealthcareId"]) {
      const value = url.searchParams.get(key);
      if (value) {
        const extracted = extractNhsId(value.trim());
        if (extracted) {
          return extracted;
        }
      }
    }
  } catch {
    // Ignore invalid URLs and fall back to plain text parsing.
  }

  return "";
}

export default function QRScannerModal({ onPatientFound, trigger }: QRScannerModalProps) {
  const [nhsId, setNhsId] = useState("");
  const [scanValue, setScanValue] = useState("");
  const [activeTab, setActiveTab] = useState("scan");
  const [scanStatus, setScanStatus] = useState("Point the camera at a CareSync QR code.");
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanRestartToken, setScanRestartToken] = useState(0);
  const [open, setOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const scanBusyRef = useRef(false);

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const closeAndReset = useCallback(() => {
    stopCamera();
    setOpen(false);
    setNhsId("");
    setScanValue("");
    setScanError(null);
    setScanStatus("Point the camera at a CareSync QR code.");
    setActiveTab("scan");
    setScanRestartToken(0);
  }, [stopCamera]);

  const submitFoundPatient = useCallback((rawValue: string) => {
    const normalized = normalizeNhsValue(rawValue);
    if (!normalized) {
      setScanError("The scanned QR code did not contain a valid NHS identifier.");
      return;
    }

    onPatientFound(normalized);
    closeAndReset();
  }, [closeAndReset, onPatientFound]);

  const handleManualSearch = () => {
    if (nhsId.trim()) {
      submitFoundPatient(nhsId.trim());
    }
  };

  const handleQrPayloadSubmit = () => {
    if (scanValue.trim()) {
      submitFoundPatient(scanValue.trim());
    }
  };

  useEffect(() => {
    if (!open || activeTab !== "scan") {
      stopCamera();
      return;
    }

    const BarcodeDetectorCtor = getBarcodeDetector();
    if (!BarcodeDetectorCtor || !navigator.mediaDevices?.getUserMedia) {
      setScanStatus("Live camera scanning is not available in this browser. Use image upload or manual entry.");
      return;
    }

    let cancelled = false;

    const startScanner = async () => {
      try {
        setScanError(null);
        setScanStatus("Requesting camera access...");
        const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          return;
        }

        video.srcObject = stream;
        await video.play();
        setScanStatus("Scanning for a CareSync QR code...");

        scanIntervalRef.current = window.setInterval(async () => {
          if (
            !videoRef.current ||
            videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
            scanBusyRef.current
          ) {
            return;
          }

          scanBusyRef.current = true;
          try {
            const barcodes = await detector.detect(videoRef.current);
            const rawValue = barcodes[0]?.rawValue;
            if (rawValue) {
              submitFoundPatient(rawValue);
            }
          } catch {
            setScanError("Camera is active, but QR decoding failed. Try better lighting or image upload.");
          } finally {
            scanBusyRef.current = false;
          }
        }, 500);
      } catch (error) {
        setScanError(error instanceof Error ? error.message : "Unable to access the camera.");
        setScanStatus("Camera scanning unavailable. You can still upload a QR image or type the NHS ID.");
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [activeTab, open, scanRestartToken, stopCamera, submitFoundPatient]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const BarcodeDetectorCtor = getBarcodeDetector();
    if (!BarcodeDetectorCtor) {
      setScanError("QR image scanning is not supported in this browser. Use manual entry instead.");
      return;
    }

    try {
      const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
      const bitmap = await createImageBitmap(file);
      const barcodes = await detector.detect(bitmap);
      bitmap.close();

      const rawValue = barcodes[0]?.rawValue;
      if (!rawValue) {
        setScanError("No QR code was detected in that image.");
        return;
      }

      submitFoundPatient(rawValue);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Unable to scan the uploaded image.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : closeAndReset())}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className={`gap-2 ${workspacePrimaryButtonClassName}`}>
            <QrCode className="h-4 w-4" />
            Add Patient
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Find Patient</DialogTitle>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="scan" className="flex-1 gap-2">
              <Camera className="h-4 w-4" />
              Scan QR
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex-1 gap-2">
              <Search className="h-4 w-4" />
              Manual Entry
            </TabsTrigger>
          </TabsList>
          <TabsContent value="scan" className="mt-4">
            <div className="space-y-4">
              <div className="w-full min-h-48 bg-muted rounded-xl border-2 border-dashed border-muted-foreground/30 overflow-hidden">
                <video
                  ref={videoRef}
                  className="w-full h-64 object-cover bg-black/80"
                  autoPlay
                  muted
                  playsInline
                />
              </div>
              <p className="text-sm text-muted-foreground">{scanStatus}</p>
              {scanError && <p className="text-sm text-destructive">{scanError}</p>}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageUp className="h-4 w-4" />
                  Scan Image
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    stopCamera();
                    setScanStatus("Restarting camera...");
                    setScanError(null);
                    setScanRestartToken((current) => current + 1);
                  }}
                >
                  <Camera className="h-4 w-4" />
                  Restart Camera
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleImageUpload}
              />
              <div className="space-y-2">
                <Label>Paste QR Payload</Label>
                <Input
                  placeholder="NHS-1234567890"
                  value={scanValue}
                  onChange={(e) => setScanValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleQrPayloadSubmit()}
                />
              </div>
              <Button
                onClick={handleQrPayloadSubmit}
                className={`w-full ${workspacePrimaryButtonClassName}`}
                disabled={!scanValue.trim()}
              >
                Process QR Payload
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="manual" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>NHS Healthcare ID</Label>
              <Input
                placeholder="e.g. NHS-9876543210"
                value={nhsId}
                onChange={(e) => setNhsId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
              />
            </div>
            <Button
              onClick={handleManualSearch}
              className={`w-full ${workspacePrimaryButtonClassName}`}
              disabled={!nhsId.trim()}
            >
              Search Patient
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
