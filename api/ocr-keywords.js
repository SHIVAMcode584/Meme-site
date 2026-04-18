/* global process */

const OCR_API_URL = "https://api.ocr.space/parse/image";
const OCR_API_KEY = process.env.OCR_SPACE_API_KEY || "helloworld";

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function extractErrorMessage(payload) {
  if (!payload) return null;

  if (Array.isArray(payload.ErrorMessage) && payload.ErrorMessage.length > 0) {
    return payload.ErrorMessage.filter(Boolean).join(" ");
  }

  if (typeof payload.ErrorMessage === "string" && payload.ErrorMessage.trim()) {
    return payload.ErrorMessage.trim();
  }

  if (typeof payload.ErrorDetails === "string" && payload.ErrorDetails.trim()) {
    return payload.ErrorDetails.trim();
  }

  if (typeof payload.ParsedText === "string" && !payload.ParsedText.trim()) {
    return "No text detected in image";
  }

  return null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return sendJson(res, 405, { error: "Method Not Allowed" });
    }

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : typeof req.body === "object" && req.body
        ? req.body
        : {};

    const imageSource = String(body?.imageSource || body?.imageUrl || body?.base64Image || "").trim();
    const isBase64 = imageSource.startsWith("data:");
    const isRemoteUrl = /^https?:\/\//i.test(imageSource);

    if (!imageSource) {
      return sendJson(res, 400, { error: "Missing image source." });
    }

    if (!isBase64 && !isRemoteUrl) {
      return sendJson(res, 400, { error: "Image source must be a direct image URL or data URL." });
    }

    const params = new URLSearchParams();
    params.set("language", String(body?.language || "eng"));
    params.set("isOverlayRequired", "false");

    if (isBase64) {
      params.set("base64Image", imageSource);
    } else {
      params.set("url", imageSource);
    }

    const response = await fetch(OCR_API_URL, {
      method: "POST",
      headers: {
        apikey: OCR_API_KEY,
      },
      body: params,
    });

    const payload = await response.json();
    const parsedText = Array.isArray(payload?.ParsedResults)
      ? payload.ParsedResults.map((item) => item?.ParsedText || "").join("\n").trim()
      : String(payload?.ParsedText || "").trim();

    const errorMessage = extractErrorMessage(payload);

    if (!response.ok || payload?.IsErroredOnProcessing || !parsedText) {
      return sendJson(res, 200, {
        ok: false,
        text: "",
        error: errorMessage || "No text detected in image",
      });
    }

    return sendJson(res, 200, {
      ok: true,
      text: parsedText,
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: error.message || "OCR request failed",
    });
  }
}
