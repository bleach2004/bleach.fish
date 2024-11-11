import React from 'react';

const Page1: React.FC = () => {
  return (
    <div style={styles.container}>
      <img src="./src/assets/page1/1.png" style={styles.image} />
      {/* <img src="./src/assets/page1/2.png" style={styles.image} />
      <img src="./src/assets/page1/1.png" className='scale-x-[-1]' style={styles.image} /> */}
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    gap: '20px', // Space between images
    marginTop: '20px', // Optional top margin
  } as React.CSSProperties,
  image: {
    width: '200px', // Adjust to desired size
    height: 'auto',
    borderRadius: '8px', // Optional rounded corners
  } as React.CSSProperties,
};

export default Page1;