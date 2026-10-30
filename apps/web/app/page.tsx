"use client";

import { useRouter } from "next/navigation";
import { FloatingNav } from "@/components/ui/floating-nav";
import { GLYPHS, DotPatternIcon } from "@/components/ui/dot-pattern-icon";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const router = useRouter();

  return (
    <>
      <FloatingNav />
      <main className="flex min-h-screen flex-col items-center justify-center gap-8 ">
        <div className="flex flex-col items-center gap-6 text-center max-w-reading">
          <div className="flex flex-col items-center gap-6">
            <DotPatternIcon
              rows={GLYPHS.orb}
              size={48}
              className="text-foreground"
            />
            <h1 className="text-h1">Signal Whisper</h1>
            <p className="text-body-lg text-muted-foreground">
              Start your session and a voice will whisper the moment stress is
              detected.
            </p>
          </div>

          <Button
            variant="gradient"
            size="lg"
            pill
            onClick={() => router.push("/watch")}
            className="px-8"
          >
            Start session
          </Button>
        </div>
      </main>
    </>
  );
}
