/// <reference types="vite/client" />
import React from "react";
import { Link } from "react-router-dom";
import matter from "gray-matter";

type PostMeta = {
  id: string;
  date: string;
};

const modules = import.meta.glob("./posts/*.md", {
  as: "raw",
  eager: true,
});

const posts: PostMeta[] = Object.entries(modules).map(([path, raw]) => {
  const { data } = matter(raw as string);
  const fileId = path.split("/").pop()?.replace(".md", "") ?? "";

  return {
    id: (data.id as string) || fileId,
    date: (data.date as string) || "",
  };
});

// Sort newest-first (best if date is ISO: YYYY-MM-DD)
posts.sort((a, b) => (a.date < b.date ? 1 : -1));

const Blog: React.FC = () => {
  return (
    <div className="wrapper">
      <div>
        {posts.map((post) => (
          <Link
            key={post.id}
            to={`/blog/${post.id}`}
            className="p text-white postlink"
          >
            {post.date}
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Blog;
