/// <reference types="vite/client" />
import React from "react";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import fm from "front-matter";

const modules = import.meta.glob("./posts/*.md", {
  as: "raw",
  eager: true,
});

type Post = {
  id: string;
  date: string;
  image?: string;
  content: string;
};

const posts: Post[] = Object.entries(modules).map(([path, raw]) => {
  const { attributes, body } = fm(raw as string);
  const fileId = path.split("/").pop()?.replace(".md", "") ?? "";
  const a = attributes as any;

  return {
    id: (a.id as string) || fileId,
    date: (a.date as string) || "",
    image: (a.image as string) || "",
    content: (body ?? "").trim(),
  };
});

const Post: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const currentPost = posts.find((p) => p.id === id);

  if (!currentPost) return <h1>Post not found</h1>;

  return (
    <div className="wrapper">
      {currentPost.content && (
        <div className="blog-text">
          <ReactMarkdown>{currentPost.content}</ReactMarkdown>
        </div>
      )}

      {currentPost.image && (
        <img
          src={"/img/" + currentPost.image}
          style={{ maxWidth: "100%", height: "auto" }}
          alt=""
        />
      )}
    </div>
  );
};

export default Post;
