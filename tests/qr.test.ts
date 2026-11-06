import { it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { PNG } from "pngjs";
import jsQR from "jsqr";
it.skipIf(!existsSync("submission/evidence/production-survey-qr.png"))(
  "decodes the PNG downloaded from the production presentation",
  () => {
    const png = PNG.sync.read(
      readFileSync("submission/evidence/production-survey-qr.png"),
    );
    const decoded = jsQR(
      new Uint8ClampedArray(png.data),
      png.width,
      png.height,
    );
    expect(decoded?.data).toBe(
      "https://classroom-survey.vercel.app/s/61692cfca7094daa8a9d58ae4e7c05d2",
    );
  },
);
