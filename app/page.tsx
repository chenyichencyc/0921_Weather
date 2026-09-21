export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="max-w-2xl w-full p-8 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-200 dark:border-slate-700 shadow-xl">
        <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 text-3xl">
          🌤️
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl mb-4">
          台灣天氣 GIS 儀表板
        </h1>
        <p className="text-slate-600 dark:text-slate-300 mb-6">
          專案骨架已成功建立 (Milestone 0)
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-full border border-emerald-200 dark:border-emerald-800">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          API Health: <a href="/api/health" className="underline hover:opacity-80">/api/health</a>
        </div>
      </div>
    </main>
  );
}
