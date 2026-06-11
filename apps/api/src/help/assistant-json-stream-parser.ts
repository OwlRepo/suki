const ESCAPED_CHARACTERS: Record<string, string> = {
  '"': '"',
  "\\": "\\",
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
};

type StringMode = "key" | "plainAnswer" | "other";

export class AssistantPlainAnswerStreamParser {
  private depth = 0;
  private expectingTopLevelKey = false;
  private pendingTopLevelKey: string | null = null;
  private stringMode: StringMode | null = null;
  private keyBuffer = "";
  private escaped = false;
  private unicodeBuffer: string | null = null;
  private completed = false;

  push(fragment: string): string {
    if (this.completed || !fragment) return "";

    let visible = "";

    for (const character of fragment) {
      if (this.completed) break;

      if (this.stringMode) {
        if (this.unicodeBuffer !== null) {
          if (!/[0-9a-fA-F]/.test(character)) {
            throw new Error("ASSISTANT_STREAM_PARSE_INVALID_UNICODE");
          }
          this.unicodeBuffer += character;
          if (this.unicodeBuffer.length === 4) {
            const decoded = String.fromCharCode(
              Number.parseInt(this.unicodeBuffer, 16),
            );
            if (this.stringMode === "key") this.keyBuffer += decoded;
            if (this.stringMode === "plainAnswer") visible += decoded;
            this.unicodeBuffer = null;
            this.escaped = false;
          }
          continue;
        }

        if (this.escaped) {
          if (character === "u") {
            this.unicodeBuffer = "";
            continue;
          }
          const decoded = ESCAPED_CHARACTERS[character];
          if (decoded === undefined) {
            throw new Error("ASSISTANT_STREAM_PARSE_INVALID_ESCAPE");
          }
          if (this.stringMode === "key") this.keyBuffer += decoded;
          if (this.stringMode === "plainAnswer") visible += decoded;
          this.escaped = false;
          continue;
        }

        if (character === "\\") {
          this.escaped = true;
          continue;
        }

        if (character === '"') {
          const completedMode = this.stringMode;
          this.stringMode = null;
          if (completedMode === "key") {
            this.pendingTopLevelKey = this.keyBuffer;
            this.keyBuffer = "";
            this.expectingTopLevelKey = false;
          } else if (completedMode === "plainAnswer") {
            this.completed = true;
          }
          continue;
        }

        if (this.stringMode === "key") this.keyBuffer += character;
        if (this.stringMode === "plainAnswer") visible += character;
        continue;
      }

      if (character === "{") {
        this.depth += 1;
        if (this.depth === 1) this.expectingTopLevelKey = true;
        continue;
      }

      if (character === "}") {
        this.depth = Math.max(0, this.depth - 1);
        continue;
      }

      if (character === "," && this.depth === 1) {
        this.expectingTopLevelKey = true;
        this.pendingTopLevelKey = null;
        continue;
      }

      if (character !== '"') continue;

      if (this.depth === 1 && this.expectingTopLevelKey) {
        this.stringMode = "key";
        this.keyBuffer = "";
        continue;
      }

      if (
        this.depth === 1 &&
        this.pendingTopLevelKey === "plainAnswer"
      ) {
        this.stringMode = "plainAnswer";
        this.pendingTopLevelKey = null;
        continue;
      }

      this.stringMode = "other";
    }

    return visible;
  }

  finish(): void {
    if (!this.completed) {
      throw new Error("ASSISTANT_STREAM_PARSE_INCOMPLETE");
    }
  }
}
