import { TelegramService } from "./telegram.service";

function configStub(values: Record<string, string | undefined>) {
  return { get: (key: string) => values[key] } as any;
}

describe("TelegramService", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("reports not configured when either secret is missing", () => {
    const svc = new TelegramService(configStub({ TELEGRAM_BOT_TOKEN: "t" }));
    expect(svc.isConfigured()).toBe(false);
  });

  it("reports configured when both secrets are present", () => {
    const svc = new TelegramService(configStub({ TELEGRAM_BOT_TOKEN: "t", TELEGRAM_BACKUP_CHANNEL_ID: "-100" }));
    expect(svc.isConfigured()).toBe(true);
  });

  it("skips archiving (returns false, no fetch call) when not configured", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as any;
    const svc = new TelegramService(configStub({}));

    const result = await svc.archiveFile({
      data: Buffer.from("x"),
      fileName: "a.txt",
      mimeType: "text/plain",
      caption: "test",
    });

    expect(result).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls sendPhoto for image mime types", async () => {
    const fetchMock = jest.fn(() => Promise.resolve({ ok: true } as Response)) as jest.Mock;
    global.fetch = fetchMock as any;
    const svc = new TelegramService(configStub({ TELEGRAM_BOT_TOKEN: "TOKEN", TELEGRAM_BACKUP_CHANNEL_ID: "-100" }));

    const result = await svc.archiveFile({
      data: Buffer.from("x"),
      fileName: "a.jpg",
      mimeType: "image/jpeg",
      caption: "test",
    });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/botTOKEN/sendPhoto");
  });

  it("calls sendDocument for non-image mime types", async () => {
    const fetchMock = jest.fn(() => Promise.resolve({ ok: true } as Response)) as jest.Mock;
    global.fetch = fetchMock as any;
    const svc = new TelegramService(configStub({ TELEGRAM_BOT_TOKEN: "TOKEN", TELEGRAM_BACKUP_CHANNEL_ID: "-100" }));

    await svc.archiveFile({
      data: Buffer.from("x"),
      fileName: "a.pdf",
      mimeType: "application/pdf",
      caption: "test",
    });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/botTOKEN/sendDocument");
  });

  it("returns false (does not throw) when Telegram responds with a non-OK status", async () => {
    const fetchMock = jest.fn(() =>
      Promise.resolve({ ok: false, status: 400, text: () => Promise.resolve("USER_BOT") } as unknown as Response),
    );
    global.fetch = fetchMock as any;
    const svc = new TelegramService(configStub({ TELEGRAM_BOT_TOKEN: "TOKEN", TELEGRAM_BACKUP_CHANNEL_ID: "-100" }));

    const result = await svc.archiveFile({
      data: Buffer.from("x"),
      fileName: "a.pdf",
      mimeType: "application/pdf",
      caption: "test",
    });

    expect(result).toBe(false);
  });

  it("returns false (does not throw) when fetch itself rejects", async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error("network down"))) as any;
    const svc = new TelegramService(configStub({ TELEGRAM_BOT_TOKEN: "TOKEN", TELEGRAM_BACKUP_CHANNEL_ID: "-100" }));

    const result = await svc.archiveFile({
      data: Buffer.from("x"),
      fileName: "a.pdf",
      mimeType: "application/pdf",
      caption: "test",
    });

    expect(result).toBe(false);
  });
});
