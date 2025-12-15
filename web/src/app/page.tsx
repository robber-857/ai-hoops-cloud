"use client";
import Link from "next/link";
import { routes } from "@/lib/routes";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold mb-6">AI Hoops</h1>
      <div className="flex gap-3">
        <Link
          href={routes.pose2d.main}
          className="rounded-xl px-4 py-2 bg-black text-white hover:opacity-90"
        >
          Start Pose 2D
        </Link>
        <Link
          href={routes.pose}
          className="rounded-xl px-4 py-2 border hover:bg-gray-50"
        >
          Pose 3D
        </Link>
      </div>
    </main>
  );
}
