import { describe, expect, it } from "vitest";
import { validateFile } from "./dataValidation";

function file(name: string, content: string): File {
  return new File([content], name, { type: "text/plain" });
}

describe("validateFile", () => {
  it("accepts valid event JSONL and detects the event profile", async () => {
    const result = await validateFile(file("events.jsonl", JSON.stringify({
      event_id: "e-1",
      source_id: "cam01",
      event_type: "zone_intrusion",
      occurred_at: "2026-10-23T10:00:00+07:00",
      created_at: "2026-10-23T10:00:01+07:00",
      result: { zone_id: "restricted_a" },
    })), "auto");

    expect(result.profile).toBe("events");
    expect(result.validRows).toBe(1);
    expect(result.issues).toHaveLength(0);
  });

  it("reports missing fields, invalid timestamps, and duplicate event IDs", async () => {
    const row = {
      event_id: "same",
      source_id: "cam01",
      event_type: "unknown",
      occurred_at: "Oct 23, 2026 10:00 AM",
      created_at: "2026-10-23T10:00:01Z",
      result: {},
    };
    const result = await validateFile(
      file("events.json", JSON.stringify([row, { ...row, source_id: "" }])),
      "events",
    );

    expect(result.validRows).toBe(0);
    expect(result.issues.some((issue) => issue.field === "occurred_at")).toBe(true);
    expect(result.issues.some((issue) => issue.field === "event_id" && issue.message.includes("Duplicate"))).toBe(true);
    expect(result.issues.some((issue) => issue.field === "source_id")).toBe(true);
  });

  it("parses quoted CSV cells and validates required sensor fields", async () => {
    const result = await validateFile(
      file("sensors.csv", 'source_id,measured_at,received_at,quality,note\r\nsensor-1,2026-10-23T10:00:00Z,2026-10-23T10:00:01Z,good,"line one, line two"\r\n'),
      "sensors",
    );

    expect(result.profile).toBe("sensors");
    expect(result.validRows).toBe(1);
    expect(result.preview[0].note).toBe("line one, line two");
  });

  it("parses JSON results from event CSV and rejects extra cells", async () => {
    const validCsv = [
      "event_id,source_id,event_type,occurred_at,created_at,result",
      'e-1,cam01,zone_intrusion,2026-10-23T10:00:00.000+07:00,2026-10-23T10:00:01.000+07:00,"{""zone_id"":""restricted_a""}"',
    ].join("\n");
    const validResult = await validateFile(file("events.csv", validCsv), "events");
    expect(validResult.validRows).toBe(1);
    expect(validResult.preview[0].result).toEqual({ zone_id: "restricted_a" });

    await expect(validateFile(file("bad.csv", "id\none,extra"), "auto"))
      .rejects.toThrow("more values than headers");
  });

  it("reports malformed JSONL with its line number", async () => {
    await expect(validateFile(file("broken.jsonl", '{"source_id":"cam01"}\n{bad'), "auto"))
      .rejects.toThrow("line 2");
  });
});
