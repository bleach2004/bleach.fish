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
    <div className='wrapper'>
      <div>
        {posts.map((post) => (
          <Link
            key={post.id}
            to={`/blog/${post.id}`}
          >
          <a className='p text-white postlink'>{post.date}</a>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Blog;