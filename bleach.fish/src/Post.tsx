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
  audio?: string;
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
    audio: (a.audio as string) || "",
    content: (body ?? "").trim(),
  };
});

const resolveMediaSrc = (value: string | undefined, defaultPrefix: string) => {
  if (!value) {
    return "";
  }

  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:") || value.startsWith("/")) {
    return value;
  }

  return `${defaultPrefix}${value}`;
};

const Post: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const currentPost = posts.find((p) => p.id === id);

  if (!currentPost) return <h1>Post not found</h1>;

  return (
    <div className="wrapper post-wrapper">
      {currentPost.content && (
        <div className="blog-text">
          <ReactMarkdown>{currentPost.content}</ReactMarkdown>
        </div>
      )}

      {currentPost.image && (
        <img
          className="post-image"
          src={resolveMediaSrc(currentPost.image, "/img/")}
          alt=""
        />
      )}

      {currentPost.audio && (
        <audio className="post-audio" controls src={resolveMediaSrc(currentPost.audio, "/audio/")} />
      )}
    </div>
  );
};

export default Post;
