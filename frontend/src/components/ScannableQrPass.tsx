import { useEffect, useMemo, useRef, useState } from "react";
import QRCodeRenderer from "qrcode";
import {
  ArrowRightLeft,
  Download,
  IdCard,
  Share2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ScannableQrPassProps {
  fullName: string;
  nhsHealthcareId: string;
  qrPayload: string;
  dateOfBirth?: string | null;
  address?: string | null;
  phoneNumber?: string | null;
  secondaryAction?: "physical" | "share";
}

interface QrMatrix {
  size: number;
  data: boolean[];
}

const CARD_ASPECT_RATIO = 85.6 / 53.98;
const PREVIEW_CARD_WIDTH = 464;
const EXPORT_CARD_WIDTH = 1000;
const EXPORT_CARD_HEIGHT = Math.round(EXPORT_CARD_WIDTH / CARD_ASPECT_RATIO);
const EXPORT_SHEET_PADDING = 72;
const EXPORT_CARD_GAP = 84;

const NHS_REFERENCE = {
  authority: "NHS England",
  office: ["Wellington House", "133-155 Waterloo Road", "London SE1 8UG"],
  postal: ["PO Box 16738", "Redditch", "B97 9PT"],
  email: "england.contactus@nhs.net",
  phone: "0300 311 22 33",
};

const NHS_REFERENCE_FOOTER = `${NHS_REFERENCE.authority} • ${NHS_REFERENCE.office.join(", ")}`;

function formatCardDate(value?: string | null): string {
  if (!value) {
    return "Not on file";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getAddressLine(address?: string | null): string {
  if (!address) {
    return "Address not on file";
  }

  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length ? parts.join(", ") : "Address not on file";
}

function formatCardholderName(fullName: string): string {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length <= 1) {
    return fullName.trim().toUpperCase();
  }

  return `${parts[0]} ${parts[parts.length - 1]}`.toUpperCase();
}

function formatCardValue(value: string): string {
  return value.toUpperCase();
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function roundedRectPerCorner(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radii: { tl: number; tr: number; br: number; bl: number },
): void {
  context.beginPath();
  context.moveTo(x + radii.tl, y);
  context.lineTo(x + width - radii.tr, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radii.tr);
  context.lineTo(x + width, y + height - radii.br);
  context.quadraticCurveTo(x + width, y + height, x + width - radii.br, y + height);
  context.lineTo(x + radii.bl, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radii.bl);
  context.lineTo(x, y + radii.tl);
  context.quadraticCurveTo(x, y, x + radii.tl, y);
  context.closePath();
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) {
    return [""];
  }

  const lines: string[] = [];
  let currentLine = words[0];

  for (const word of words.slice(1)) {
    const candidate = `${currentLine} ${word}`;
    if (context.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
      continue;
    }
    lines.push(currentLine);
    currentLine = word;
  }

  lines.push(currentLine);
  return lines;
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines?: number,
): number {
  const lines = wrapText(context, text, maxWidth);
  const visibleLines = maxLines ? lines.slice(0, maxLines) : lines;

  visibleLines.forEach((line, index) => {
    const truncated =
      maxLines && index === visibleLines.length - 1 && lines.length > visibleLines.length;
    context.fillText(truncated ? `${line}...` : line, x, y + index * lineHeight);
  });

  return y + (visibleLines.length - 1) * lineHeight;
}

function createQrMatrix(payload: string): QrMatrix {
  const qr = QRCodeRenderer.create(payload, { errorCorrectionLevel: "H" });
  return {
    size: qr.modules.size,
    data: Array.from(qr.modules.data as Iterable<boolean>),
  };
}

function qrIsDark(matrix: QrMatrix, row: number, column: number): boolean {
  if (row < 0 || column < 0 || row >= matrix.size || column >= matrix.size) {
    return false;
  }
  return Boolean(matrix.data[row * matrix.size + column]);
}

function qrInFinderZone(matrix: QrMatrix, row: number, column: number): boolean {
  const starts = [
    [0, 0],
    [0, matrix.size - 7],
    [matrix.size - 7, 0],
  ];

  return starts.some(
    ([startRow, startColumn]) =>
      row >= startRow &&
      row < startRow + 7 &&
      column >= startColumn &&
      column < startColumn + 7,
  );
}

function drawFinderPattern(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  moduleSize: number,
  color: string,
): void {
  const outerSize = moduleSize * 7;
  const middleSize = moduleSize * 5;
  const innerSize = moduleSize * 3;

  roundedRect(context, x, y, outerSize, outerSize, moduleSize * 1.8);
  context.fillStyle = color;
  context.fill();

  roundedRect(context, x + moduleSize, y + moduleSize, middleSize, middleSize, moduleSize * 1.3);
  context.fillStyle = "#ffffff";
  context.fill();

  roundedRect(context, x + moduleSize * 2, y + moduleSize * 2, innerSize, innerSize, moduleSize);
  context.fillStyle = color;
  context.fill();
}

function drawStyledQr(
  context: CanvasRenderingContext2D,
  matrix: QrMatrix,
  x: number,
  y: number,
  size: number,
  color = "#082746",
): void {
  const quietZone = 2;
  const totalModules = matrix.size + quietZone * 2;
  const moduleSize = size / totalModules;
  const moduleRadius = moduleSize * 0.44;

  context.save();
  context.translate(x, y);

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size, size);

  drawFinderPattern(context, quietZone * moduleSize, quietZone * moduleSize, moduleSize, color);
  drawFinderPattern(
    context,
    (quietZone + matrix.size - 7) * moduleSize,
    quietZone * moduleSize,
    moduleSize,
    color,
  );
  drawFinderPattern(
    context,
    quietZone * moduleSize,
    (quietZone + matrix.size - 7) * moduleSize,
    moduleSize,
    color,
  );

  context.fillStyle = color;

  for (let row = 0; row < matrix.size; row += 1) {
    for (let column = 0; column < matrix.size; column += 1) {
      if (!qrIsDark(matrix, row, column) || qrInFinderZone(matrix, row, column)) {
        continue;
      }

      const top = qrIsDark(matrix, row - 1, column);
      const right = qrIsDark(matrix, row, column + 1);
      const bottom = qrIsDark(matrix, row + 1, column);
      const left = qrIsDark(matrix, row, column - 1);

      const px = (column + quietZone) * moduleSize;
      const py = (row + quietZone) * moduleSize;

      roundedRectPerCorner(context, px, py, moduleSize, moduleSize, {
        tl: !top && !left ? moduleRadius : 0,
        tr: !top && !right ? moduleRadius : 0,
        br: !bottom && !right ? moduleRadius : 0,
        bl: !bottom && !left ? moduleRadius : 0,
      });
      context.fill();
    }
  }

  context.restore();
}

function drawCardBase(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  context.save();
  context.translate(x, y);

  roundedRect(context, 0, 0, width, height, 42);
  context.fillStyle = "#ffffff";
  context.fill();
  context.strokeStyle = "#d9e3ee";
  context.lineWidth = 2;
  context.stroke();

  context.save();
  roundedRect(context, 0, 0, width, height, 42);
  context.clip();

  const accentGradient = context.createLinearGradient(width * 0.7, 0, width, height);
  accentGradient.addColorStop(0, "#0b4a88");
  accentGradient.addColorStop(1, "#2f9ae0");
  context.fillStyle = accentGradient;
  context.beginPath();
  context.ellipse(width + 18, height / 2, 280, height * 0.95, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "rgba(255,255,255,0.15)";
  context.beginPath();
  context.ellipse(width - 26, height / 2, 120, height * 0.56, 0, 0, Math.PI * 2);
  context.fill();

  context.restore();
  context.restore();
}

type CanvasProcessIcon = "card" | "scan" | "keyboard" | "shield";

function drawProcessIcon(
  context: CanvasRenderingContext2D,
  kind: CanvasProcessIcon,
  x: number,
  y: number,
  size: number,
): void {
  context.save();

  roundedRect(context, x, y, size, size, 9);
  context.fillStyle = "#eff6ff";
  context.fill();
  context.strokeStyle = "#cfe3f7";
  context.lineWidth = 1.5;
  context.stroke();

  context.strokeStyle = "#0b4a88";
  context.fillStyle = "#0b4a88";
  context.lineWidth = 1.8;
  context.lineCap = "round";
  context.lineJoin = "round";

  if (kind === "card") {
    roundedRect(context, x + 5, y + 6, size - 10, size - 12, 4);
    context.stroke();
    context.beginPath();
    context.moveTo(x + 7, y + 11);
    context.lineTo(x + size - 7, y + 11);
    context.stroke();
  }

  if (kind === "scan") {
    context.beginPath();
    context.moveTo(x + 7, y + 11);
    context.lineTo(x + 7, y + 7);
    context.lineTo(x + 11, y + 7);
    context.moveTo(x + size - 7, y + 11);
    context.lineTo(x + size - 7, y + 7);
    context.lineTo(x + size - 11, y + 7);
    context.moveTo(x + 7, y + size - 11);
    context.lineTo(x + 7, y + size - 7);
    context.lineTo(x + 11, y + size - 7);
    context.moveTo(x + size - 7, y + size - 11);
    context.lineTo(x + size - 7, y + size - 7);
    context.lineTo(x + size - 11, y + size - 7);
    context.moveTo(x + 10, y + size / 2);
    context.lineTo(x + size - 10, y + size / 2);
    context.stroke();
  }

  if (kind === "keyboard") {
    roundedRect(context, x + 4.5, y + 6, size - 9, size - 12, 4);
    context.stroke();
    const startX = x + 8;
    const startY = y + 10;
    const gap = 4.2;
    for (let row = 0; row < 2; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        context.beginPath();
        context.arc(startX + column * gap, startY + row * gap, 1, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  if (kind === "shield") {
    context.beginPath();
    context.moveTo(x + size / 2, y + 5.5);
    context.lineTo(x + size - 7, y + 8.5);
    context.lineTo(x + size - 8.5, y + size - 10);
    context.lineTo(x + size / 2, y + size - 5.5);
    context.lineTo(x + 8.5, y + size - 10);
    context.lineTo(x + 7, y + 8.5);
    context.closePath();
    context.stroke();

    context.beginPath();
    context.moveTo(x + 9.5, y + size / 2);
    context.lineTo(x + size / 2 - 1.5, y + size - 8.5);
    context.lineTo(x + size - 8, y + 9.5);
    context.stroke();
  }

  context.restore();
}

function drawFrontCard(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  data: {
    fullName: string;
    nhsHealthcareId: string;
    dateOfBirth?: string | null;
    address?: string | null;
    qrPayload: string;
    issuedOn: string;
    qrMatrix: QrMatrix;
  },
): void {
  drawCardBase(context, x, y, width, height);
  context.save();
  context.translate(x, y);

  const displayName = formatCardholderName(data.fullName);
  const displayNhsHealthcareId = data.nhsHealthcareId.toUpperCase();
  const displayBirthDate = formatCardValue(formatCardDate(data.dateOfBirth));
  const displayAddress = formatCardValue(getAddressLine(data.address));
  const scale = width / PREVIEW_CARD_WIDTH;
  const px = (value: number) => value * scale;
  const leftX = px(20);
  const topY = px(28);
  const rightSectionWidth = width * 0.34;
  const qrSectionX = width - rightSectionWidth;
  const qrFrameSize = px(132);
  const qrCodeSize = px(108);
  const qrFrameRightInset = px(18);
  const qrFrameX = width - qrFrameRightInset - qrFrameSize;
  const qrFrameY = (height - qrFrameSize) / 2;
  const qrCodeX = qrFrameX + (qrFrameSize - qrCodeSize) / 2;
  const qrCodeY = qrFrameY + (qrFrameSize - qrCodeSize) / 2;
  const labelWidth = px(112);
  const valueX = leftX + labelWidth + px(16);
  const valueWidth = qrSectionX - valueX - px(18);

  context.fillStyle = "#64748b";
  context.font = `700 ${px(10)}px Arial`;
  context.fillText("CARESYNC DIGITAL HEALTH CARD", leftX, topY);
  context.font = `600 ${px(10)}px Arial`;
  context.fillText("National Health Service linked patient access", leftX, topY + px(22));

  context.fillStyle = "#64748b";
  context.font = `700 ${px(9)}px Arial`;
  context.fillText("CARDHOLDER", leftX, px(84));

  context.fillStyle = "#0f172a";
  context.font = `700 ${px(14.4)}px Arial`;
  const nameEndY = drawWrappedText(
    context,
    displayName,
    leftX,
    px(106),
    qrSectionX - leftX - px(18),
    px(18),
    2,
  );

  const drawDetailLine = (label: string, value: string, yPos: number) => {
    context.fillStyle = "#64748b";
    context.font = `700 ${px(7.4)}px Arial`;
    context.fillText(label.toUpperCase(), leftX, yPos);
    context.fillStyle = "#0f172a";
    context.font = `700 ${px(9.7)}px Arial`;
    drawWrappedText(context, value, valueX, yPos, valueWidth, px(13), 2);
  };

  const detailStartY = nameEndY + px(28);
  drawDetailLine("NHS Number", displayNhsHealthcareId, detailStartY);
  drawDetailLine("Birth Date", displayBirthDate, detailStartY + px(24));
  drawDetailLine("Address", displayAddress, detailStartY + px(48));
  drawDetailLine("Issued", data.issuedOn, detailStartY + px(72));

  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.font = `700 ${px(10)}px Arial`;
  context.fillText("PATIENT QR", qrSectionX + rightSectionWidth / 2, px(148));
  context.font = `600 ${px(11)}px Arial`;
  context.fillText("Scan for live record", qrSectionX + rightSectionWidth / 2, px(166));

  roundedRect(context, qrFrameX, qrFrameY, qrFrameSize, qrFrameSize, px(19));
  context.fillStyle = "#ffffff";
  context.fill();
  context.strokeStyle = "#dfe8f2";
  context.lineWidth = 2;
  context.stroke();

  drawStyledQr(context, data.qrMatrix, qrCodeX, qrCodeY, qrCodeSize);
  context.textAlign = "left";

  context.restore();
}

function drawBackCard(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  drawCardBase(context, x, y, width, height);
  context.save();
  context.translate(x, y);
  const scale = width / PREVIEW_CARD_WIDTH;
  const px = (value: number) => value * scale;

  context.fillStyle = "#0b4a88";
  context.fillRect(0, 0, width, px(8));

  const backSteps: Array<{ icon: CanvasProcessIcon; text: string }> = [
    {
      icon: "card",
      text: "Show this card to your CareSync provider.",
    },
    {
      icon: "scan",
      text: "Hold the QR flat for a quick scan.",
    },
    {
      icon: "keyboard",
      text: "If scanning fails, staff can verify manually.",
    },
    {
      icon: "shield",
      text: "Identity checks still apply before access.",
    },
  ];

  const guideGradient = context.createLinearGradient(px(20), px(20), width - px(20), px(74));
  guideGradient.addColorStop(0, "#0b4a88");
  guideGradient.addColorStop(1, "#2f9ae0");
  roundedRect(context, px(20), px(20), width - px(40), px(42), px(18));
  context.fillStyle = guideGradient;
  context.fill();

  context.fillStyle = "rgba(255,255,255,0.72)";
  context.font = `700 ${px(8)}px Arial`;
  context.fillText("CARESYNC ACCESS GUIDE", px(34), px(36));
  context.fillStyle = "#ffffff";
  context.font = `700 ${px(15)}px Arial`;
  context.fillText("Quick care access steps", px(34), px(54));

  let rowY = px(78);
  backSteps.forEach((step) => {
    roundedRect(context, px(20), rowY, width - px(40), px(30), px(12));
    context.fillStyle = "rgba(255,255,255,0.9)";
    context.fill();
    context.strokeStyle = "#dbeafe";
    context.lineWidth = 1.5;
    context.stroke();

    drawProcessIcon(context, step.icon, px(28), rowY + px(8), px(14));
    context.fillStyle = "#475569";
    context.font = `600 ${px(9.5)}px Arial`;
    drawWrappedText(context, step.text, px(50), rowY + px(19), width - px(90), px(12), 1);
    rowY += px(34);
  });

  context.strokeStyle = "#d9e3ee";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(px(34), height - px(18));
  context.lineTo(width - px(34), height - px(18));
  context.stroke();

  context.fillStyle = "#0f172a";
  context.font = `600 ${px(6.2)}px Arial`;
  context.textAlign = "center";
  context.fillText(NHS_REFERENCE_FOOTER, width / 2, height - px(7));
  context.textAlign = "left";

  context.restore();
}

async function buildPassBlob(data: {
  fullName: string;
  nhsHealthcareId: string;
  qrPayload: string;
  dateOfBirth?: string | null;
  address?: string | null;
  issuedOn: string;
}): Promise<Blob> {
  const qrMatrix = createQrMatrix(data.qrPayload);

  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_CARD_WIDTH + EXPORT_SHEET_PADDING * 2;
  canvas.height = EXPORT_CARD_HEIGHT * 2 + EXPORT_CARD_GAP + EXPORT_SHEET_PADDING * 2 + 46;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create digital health card image");
  }

  const sheetGradient = context.createLinearGradient(0, 0, 0, canvas.height);
  sheetGradient.addColorStop(0, "#eef5fb");
  sheetGradient.addColorStop(1, "#dde8f4");
  context.fillStyle = sheetGradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#0f172a";
  context.font = "700 24px Arial";
  context.fillText("CareSync Digital Health Card", EXPORT_SHEET_PADDING, 38);

  drawFrontCard(context, EXPORT_SHEET_PADDING, 64, EXPORT_CARD_WIDTH, EXPORT_CARD_HEIGHT, {
    fullName: data.fullName,
    nhsHealthcareId: data.nhsHealthcareId,
    dateOfBirth: data.dateOfBirth,
    address: data.address,
    qrPayload: data.qrPayload,
    issuedOn: data.issuedOn,
    qrMatrix,
  });

  drawBackCard(
    context,
    EXPORT_SHEET_PADDING,
    64 + EXPORT_CARD_HEIGHT + EXPORT_CARD_GAP,
    EXPORT_CARD_WIDTH,
    EXPORT_CARD_HEIGHT,
  );

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("Unable to export the health card"));
    }, "image/png");
  });
}

function RenderedCardCanvas({
  draw,
  className,
}: {
  draw: (context: CanvasRenderingContext2D, width: number, height: number) => void;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const width = PREVIEW_CARD_WIDTH;
    const height = Math.round(PREVIEW_CARD_WIDTH / CARD_ASPECT_RATIO);
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.scale(dpr, dpr);
    draw(context, width, height);
  }, [draw]);

  return <canvas ref={canvasRef} className={cn("block h-full w-full", className)} aria-hidden="true" />;
}

function CardFrontPreview({
  fullName,
  nhsHealthcareId,
  qrPayload,
  dateOfBirth,
  address,
  issuedOn,
}: {
  fullName: string;
  nhsHealthcareId: string;
  qrPayload: string;
  dateOfBirth?: string | null;
  address?: string | null;
  issuedOn: string;
}) {
  const qrMatrix = useMemo(() => createQrMatrix(qrPayload), [qrPayload]);

  return (
    <div className="absolute inset-0 [backface-visibility:hidden]">
      <RenderedCardCanvas
        draw={(context, width, height) =>
          drawFrontCard(context, 0, 0, width, height, {
            fullName,
            nhsHealthcareId,
            dateOfBirth,
            address,
            qrPayload,
            issuedOn,
            qrMatrix,
          })
        }
      />
    </div>
  );
}

function CardBackPreview() {
  return (
    <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
      <RenderedCardCanvas draw={(context, width, height) => drawBackCard(context, 0, 0, width, height)} />
      </div>
  );
}

export default function ScannableQrPass({
  fullName,
  nhsHealthcareId,
  qrPayload,
  dateOfBirth,
  address,
  phoneNumber,
  secondaryAction = "physical",
}: ScannableQrPassProps) {
  const { toast } = useToast();
  const [showBack, setShowBack] = useState(false);

  const formattedDateOfBirth = formatCardDate(dateOfBirth);
  const addressLine = getAddressLine(address);
  const issuedOn = useMemo(
    () =>
      new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    [],
  );

  const downloadName = useMemo(
    () =>
      `${nhsHealthcareId.toLowerCase().replace(/[^a-z0-9-]/g, "-")}-nhs-digital-health-card.png`,
    [nhsHealthcareId],
  );

  const physicalCardRequest = useMemo(
    () =>
      [
        "Physical digital health card request",
        `Patient name: ${fullName}`,
        `NHS number: ${nhsHealthcareId}`,
        `Date of birth: ${formattedDateOfBirth}`,
        `Address: ${addressLine}`,
        `Phone number: ${phoneNumber ?? "Not on file"}`,
        `Generated from CareSync on ${issuedOn}`,
      ].join("\n"),
    [addressLine, formattedDateOfBirth, fullName, issuedOn, nhsHealthcareId, phoneNumber],
  );

  const downloadCard = async (): Promise<void> => {
    try {
      const blob = await buildPassBlob({
        fullName,
        nhsHealthcareId,
        qrPayload,
        dateOfBirth,
        address,
        issuedOn,
      });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = downloadName;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      toast({
        title: "Unable to export the digital card",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  const orderPhysicalCard = async (): Promise<void> => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(physicalCardRequest);
      }

      toast({
        title: "Physical card request prepared",
        description: "The patient details were copied for your print-card workflow.",
      });
    } catch {
      toast({
        title: "Physical card request not copied",
        description: "Clipboard access was blocked. Use the details on the card for ordering.",
      });
    }
  };

  const shareCard = async (): Promise<void> => {
    const shareDetails = [
      "CareSync digital health card",
      `Patient: ${fullName}`,
      `NHS number: ${nhsHealthcareId}`,
      `Verification payload: ${qrPayload}`,
    ].join("\n");

    try {
      const blob = await buildPassBlob({
        fullName,
        nhsHealthcareId,
        qrPayload,
        dateOfBirth,
        address,
        issuedOn,
      });

      if (typeof navigator.share === "function") {
        const file = new File([blob], downloadName, { type: "image/png" });
        if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `${fullName} digital health card`,
            text: shareDetails,
            files: [file],
          });
          return;
        }

        await navigator.share({
          title: `${fullName} digital health card`,
          text: shareDetails,
        });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareDetails);
      }

      toast({
        title: "Share details copied",
        description: "Native sharing is unavailable, so the card details were copied instead.",
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      toast({
        title: "Unable to share the digital card",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="w-full max-w-[29rem] space-y-4 text-left">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-muted-foreground">
          Digital Health Card
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setShowBack((current) => !current)}
        >
          <ArrowRightLeft className="h-4 w-4" />
          {showBack ? "View Front" : "View Back"}
        </Button>
      </div>

      <div className="[perspective:1800px]">
        <button
          type="button"
          onClick={() => setShowBack((current) => !current)}
          className="block w-full text-left"
          aria-label={showBack ? "Show front of digital health card" : "Show back of digital health card"}
        >
          <div
            className={cn(
              "relative mx-auto w-full transition-transform duration-700 [transform-style:preserve-3d]",
              showBack && "[transform:rotateY(180deg)]",
            )}
            style={{ aspectRatio: CARD_ASPECT_RATIO }}
          >
            <CardFrontPreview
              fullName={fullName}
              nhsHealthcareId={nhsHealthcareId}
              qrPayload={qrPayload}
              dateOfBirth={dateOfBirth}
              address={address}
              issuedOn={issuedOn}
            />
            <CardBackPreview />
          </div>
        </button>
      </div>

      <div className="grid gap-2">
        <Button
          type="button"
          className="w-full gap-2 gradient-primary border-0"
          onClick={() => void downloadCard()}
        >
          <Download className="h-4 w-4" />
          Download Your NHS Digital Health Card
        </Button>
        {secondaryAction === "share" ? (
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={() => void shareCard()}
          >
            <Share2 className="h-4 w-4" />
            Share Your Digital Health Card
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={() => void orderPhysicalCard()}
          >
            <IdCard className="h-4 w-4" />
            Order The Physical Card
          </Button>
        )}
      </div>
    </div>
  );
}
