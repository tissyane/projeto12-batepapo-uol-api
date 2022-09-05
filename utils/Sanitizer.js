import { stripHtml } from "string-strip-html";

export default function sanitizer(text) {
  return stripHtml(text).result.trim();
}
