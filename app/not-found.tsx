export default function NotFound() {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center justify-center">
        <section className="pixel-panel w-full text-center">
          <div className="font-display text-[11px] uppercase tracking-[0.35em] text-[color:var(--game-muted)]">
            页面未找到
          </div>
          <h1 className="mt-4 text-3xl font-black text-[color:var(--game-text)] sm:text-5xl">这个房间入口不存在</h1>
          <p className="mt-4 text-sm leading-7 text-[color:var(--game-subtle)] sm:text-base">
            你点到了一扇还没放进房间里的门。返回首页后，继续从房间里的物件进入各个日志分区就可以了。
          </p>
          <a href="/" className="pixel-button mt-6 inline-flex items-center justify-center text-sm">
            回到 Louis 房间
          </a>
        </section>
      </div>
    </main>
  )
}
