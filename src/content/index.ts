import { X_INLINE_ENABLED } from "./feature-flags";

if (X_INLINE_ENABLED) {
  void import("./bootstrap");
}
