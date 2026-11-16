"use client";
import { ErrorMessage } from "@/components/ui";
export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="standalone-error">
      <ErrorMessage message={error.message} />
      <button className="btn primary" onClick={reset}>
        重新加载
      </button>
    </div>
  );
}
