import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Alert, Button, Flex, Popconfirm, Typography } from "antd";
import { useKioskAuth } from "./KioskAuthContext";
import { kioskApi, KioskApiError, type KioskScanResult } from "../api/kioskClient";

const READER_ELEMENT_ID = "kiosk-qr-reader";
const FEEDBACK_DISPLAY_MS = 3000;

type Feedback = { kind: "success"; result: KioskScanResult } | { kind: "error"; message: string } | null;

export default function KioskScannerScreen() {
  const { branchId, deviceName, unpair } = useKioskAuth();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    const scanner = new Html5Qrcode(READER_ELEMENT_ID);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        (decodedText) => void handleDecode(decodedText),
        () => {}, // fires continuously while no QR is in frame — not an error
      )
      .catch((err) => setCameraError(err instanceof Error ? err.message : String(err)));

    return () => {
      // .stop() can throw *synchronously* (not just reject) if called before
      // .start()'s camera init has actually finished — notably under React
      // 18 StrictMode's dev-only double mount/unmount/mount. A bare
      // .catch() only guards the async rejection case, so this also needs
      // a try/catch around the call itself.
      try {
        scanner.stop().catch(() => {});
      } catch {
        // scanner was never fully started — nothing to stop
      }
    };
  }, []);

  async function handleDecode(decodedText: string) {
    if (busyRef.current || !branchId) return;
    busyRef.current = true;
    try {
      await scannerRef.current?.pause(true);
    } catch {
      // scanner may already be stopped — irrelevant here
    }

    try {
      const result = await kioskApi.scan(branchId, decodedText);
      setFeedback({ kind: "success", result });
    } catch (err) {
      if (err instanceof KioskApiError && err.status === 401) {
        unpair();
        return;
      }
      setFeedback({ kind: "error", message: err instanceof KioskApiError ? err.message : "Ошибка" });
    }

    setTimeout(() => {
      setFeedback(null);
      busyRef.current = false;
      try {
        scannerRef.current?.resume();
      } catch {
        // ignore
      }
    }, FEEDBACK_DISPLAY_MS);
  }

  return (
    <Flex vertical align="center" justify="center" style={{ minHeight: "100vh", padding: 24, position: "relative" }}>
      <Typography.Title level={3} style={{ color: "#fff" }}>
        {deviceName ?? "Киоск"}
      </Typography.Title>
      <Typography.Text style={{ color: "#aaa", marginBottom: 16 }}>
        Наведите камеру на QR-код из приложения
      </Typography.Text>

      <div id={READER_ELEMENT_ID} style={{ width: 320, maxWidth: "90vw", borderRadius: 12, overflow: "hidden" }} />

      {cameraError && (
        <Alert
          type="error"
          message={`Камера недоступна: ${cameraError}`}
          style={{ marginTop: 16, maxWidth: 400 }}
          showIcon
        />
      )}

      {feedback?.kind === "success" && (
        <Alert
          type="success"
          showIcon
          style={{ marginTop: 16, maxWidth: 400, fontSize: 18 }}
          message={`${feedback.result.staffFullName} — ${feedback.result.type === "CHECK_IN" ? "приход" : "уход"}`}
          description={new Date(feedback.result.occurredAt).toLocaleTimeString("ru-RU")}
        />
      )}
      {feedback?.kind === "error" && (
        <Alert type="error" showIcon style={{ marginTop: 16, maxWidth: 400 }} message={feedback.message} />
      )}

      <Popconfirm title="Отключить это устройство?" onConfirm={unpair} okText="Отключить" cancelText="Отмена">
        <Button size="small" type="text" style={{ position: "absolute", bottom: 12, right: 12, color: "#555" }}>
          Настроить заново
        </Button>
      </Popconfirm>
    </Flex>
  );
}
