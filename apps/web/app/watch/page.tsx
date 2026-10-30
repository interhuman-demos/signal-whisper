import { Suspense } from "react";
import { WatchExperience } from "./_components/watch-experience";

export const metadata = {
  title: "Watch Session — Signal Whisper",
};

export default function WatchPage() {
  return (
    <Suspense fallback={null}>
      <WatchExperience />
    </Suspense>
  );
}
