import { PhantomExplorer } from "@/components/PhantomExplorer";
import Dither from "@/components/Dither";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 z-0">
        <Dither
          waveColor={[0.486, 0.361, 1.0]}
          waveSpeed={0.05}
          waveFrequency={3}
          waveAmplitude={0.35}
          colorNum={4}
          pixelSize={2}
          enableMouseInteraction={false}
        />

        <div className="absolute inset-0 z-10 opacity-70">
          <div className="absolute left-1/2 top-[-40%] h-[900px] w-[900px] -translate-x-1/2 rounded-full bg-accent/25 blur-3xl" />
          <div className="absolute right-[-15%] top-[10%] h-[520px] w-[520px] rounded-full bg-accent2/20 blur-3xl" />
          <div className="absolute left-[-20%] bottom-[-25%] h-[600px] w-[600px] rounded-full bg-accent3/15 blur-3xl" />

          {/* Subtle grid “wall” hint */}
          <div
            className="absolute inset-0 bg-[linear-gradient(to_right,rgba(217,230,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(217,230,255,0.06)_1px,transparent_1px)] bg-[size:64px_64px] [transform:perspective(900px)_rotateX(58deg)] [transform-origin:50%_70%] opacity-50"
          />
        </div>
      </div>

      <main className="relative z-10 mx-auto max-w-7xl px-6 py-6">
        <PhantomExplorer />
      </main>
    </div>
  );
}
