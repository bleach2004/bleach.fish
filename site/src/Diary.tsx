/// <reference types="vite/client" />
import React from "react";
import { Link } from "react-router-dom";
import fm from "front-matter";

type PostMeta = {
  id: string;
  date: string;
};

const modules = import.meta.glob("./posts/*.md", {
  as: "raw",
  eager: true,
});

const posts: PostMeta[] = Object.entries(modules).map(([path, raw]) => {
  const { attributes } = fm(raw as string);
  const fileId = path.split("/").pop()?.replace(".md", "") ?? "";
  const a = attributes as any;

  return {
    id: (a.id as string) || fileId,
    date: (a.date as string) || "",
  };
});

// Sort newest-first (best if date is ISO: YYYY-MM-DD)
posts.sort((a, b) => (a.date < b.date ? 1 : -1));

const Diary: React.FC = () => {
  return (
    <div className="wrapper">
      <div>
        {posts.map((post) => (
          <Link
            key={post.id}
            to={`/diary/${post.id}`}
            className="p text-white postlink"
          >
            {post.date || post.id}
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Diary;
