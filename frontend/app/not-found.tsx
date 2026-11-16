import Link from "next/link";
export default function Page() {
  return (
    <main className="standalone-error">
      <h1>这一幕还没有开始</h1>
      <p>页面不存在，回到你的故事继续创作。</p>
      <Link className="btn primary" href="/projects">
        我的故事
      </Link>
    </main>
  );
}
