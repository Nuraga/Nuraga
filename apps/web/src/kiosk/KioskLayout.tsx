import { Outlet } from "react-router-dom";
import { KioskAuthProvider } from "./KioskAuthContext";

// Deliberately no AppLayout/BranchProvider/sidebar — a kiosk is a single
// fullscreen scanner screen bolted to a wall, not a multi-page staff app.
// KioskAuthProvider lives here rather than in App.tsx so its device-session
// state never leaks outside the /kiosk subtree.
export default function KioskLayout() {
  return (
    <KioskAuthProvider>
      <div style={{ minHeight: "100vh", background: "#000" }}>
        <Outlet />
      </div>
    </KioskAuthProvider>
  );
}
