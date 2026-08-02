import { useKioskAuth } from "./KioskAuthContext";
import KioskSetupScreen from "./KioskSetupScreen";
import KioskScannerScreen from "./KioskScannerScreen";

export default function KioskPage() {
  const { status } = useKioskAuth();
  return status === "paired" ? <KioskScannerScreen /> : <KioskSetupScreen />;
}
