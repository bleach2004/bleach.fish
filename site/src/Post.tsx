/// <reference types="vite/client" />
import React, { useLayoutEffect, useRef } from "react";
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

const MOBILE_BREAKPOINT = 668;

const getTextBlocks = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("p, li, blockquote"));

const getLongestLineWidth = (container: HTMLElement) => {
  const computed = window.getComputedStyle(container);
  const font = [
    computed.fontStyle,
    computed.fontVariant,
    computed.fontWeight,
    computed.fontStretch,
    computed.fontSize,
    computed.fontFamily,
  ]
    .filter(Boolean)
    .join(" ");

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return 0;
  }

  context.font = font;

  return getTextBlocks(container).reduce((widest, block) => {
    const lines = (block.textContent ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const blockWidest = lines.reduce((lineWidest, line) => {
      return Math.max(lineWidest, context.measureText(line).width);
    }, 0);

    return Math.max(widest, blockWidest);
  }, 0);
};

const markdownComponents = {
  p: ({ node: _node, ...props }: React.ComponentProps<"p"> & { node?: unknown }) => (
    <p {...props} style={{ fontSize: "inherit" }} />
  ),
  li: ({ node: _node, ...props }: React.ComponentProps<"li"> & { node?: unknown }) => (
    <li {...props} style={{ fontSize: "inherit" }} />
  ),
  a: ({ node: _node, ...props }: React.ComponentProps<"a"> & { node?: unknown }) => (
    <a {...props} style={{ fontSize: "inherit" }} />
  ),
  blockquote: ({ node: _node, ...props }: React.ComponentProps<"blockquote"> & { node?: unknown }) => (
    <blockquote {...props} style={{ fontSize: "inherit" }} />
  ),
};

const Post: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const textRef = useRef<HTMLDivElement | null>(null);

  const currentPost = posts.find((p) => p.id === id);

  useLayoutEffect(() => {
    const container = textRef.current;

    if (!container) {
      return;
    }

    const updateFontSize = () => {
      const baseSize = parseFloat(
        window.getComputedStyle(document.documentElement).getPropertyValue("--times-text-size"),
      );

      if (!Number.isFinite(baseSize) || window.innerWidth > MOBILE_BREAKPOINT) {
        container.style.removeProperty("--diary-text-size");
        return;
      }

      const availableWidth = container.clientWidth;
      const widestLine = getLongestLineWidth(container);

      if (!availableWidth || !widestLine || widestLine <= availableWidth) {
        container.style.removeProperty("--diary-text-size");
        return;
      }

      const nextSize = Math.max(12, Math.floor((baseSize * availableWidth) / widestLine));

      if (nextSize >= baseSize) {
        container.style.removeProperty("--diary-text-size");
        return;
      }

      container.style.setProperty("--diary-text-size", `${nextSize}px`);
    };

    updateFontSize();

    const resizeObserver = new ResizeObserver(updateFontSize);
    resizeObserver.observe(container);

    window.addEventListener("resize", updateFontSize);

    document.fonts?.ready.then(updateFontSize).catch(() => {});

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateFontSize);
    };
  }, [currentPost?.id]);

  if (!currentPost) return <h1>Post not found</h1>;

  return (
    <div className="wrapper post-wrapper">
      {currentPost.content && (
        <div
          ref={textRef}
          className="diary-text"
          style={{ fontSize: "var(--diary-text-size, var(--times-text-size))" }}
        >
          <ReactMarkdown components={markdownComponents}>{currentPost.content}</ReactMarkdown>
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
