import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type HealthState = "checking" | "ok" | "error";

export default function App() {
  const { t } = useTranslation();
  const [health, setHealth] = useState<HealthState>("checking");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => (res.ok ? setHealth("ok") : setHealth("error")))
      .catch(() => setHealth("error"));
  }, []);

  return (
    <main>
      <h1>{t("app.title")}</h1>
      <p>{t(`health.${health}`)}</p>
    </main>
  );
}
