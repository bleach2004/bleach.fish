import { Link } from 'react-router-dom';
import postsJson from './blog/posts.json'; // Adjust the relative path as needed

interface Post {
  id: string;
  date: string;
}

const Blog: React.FC = () => {
  // Ensure the data matches the Post interface
  const posts: Post[] = postsJson;

  return (
    <div style={{ padding: '20px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: '16px',
        }}
      >
        {posts.map((post) => (
          <Link
            key={post.id}
            to={`/blog/${post.id}`}
            style={{ textDecoration: 'none' }}
          >
          <p>{post.date}</p>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Blog;