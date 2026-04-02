import { useState } from 'react';
import './ProductCard.css';

function ProductCard({ product }) {
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  const handleImageError = (e) => {
    setImageLoadFailed(true);
    e.target.src = 'https://via.placeholder.com/200x200?text=No+Image';
    e.target.style.opacity = '0.6';
  };

  // Convert numeric rating to star display
  const renderStars = (rating) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    let stars = '★'.repeat(fullStars);
    if (hasHalfStar && fullStars < 5) stars += '☆';
    return stars;
  };

  return (
    <div className="product-card">
      <div className="product-image-container">
        <img 
          src={product.image} 
          alt={product.name} 
          className="product-image"
          onError={handleImageError}
        />
        {imageLoadFailed && (
          <div className="image-error-badge">
            <span className="error-icon">⚠️</span>
            <span className="error-text">Image Not Available</span>
          </div>
        )}
      </div>
      <div className="product-info">
        <h3 className="product-name">{product.name}</h3>
        {product.description && (
          <p className="product-description">{product.description}</p>
        )}
        <div className="product-meta">
          <p className="product-price">₹{product.price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          {product.rating > 0 && (
            <div className="product-rating">
              <span className="rating-stars">{renderStars(product.rating)}</span>
              {product.ratings_count > 0 && (
                <span className="rating-count">({product.ratings_count})</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProductCard;
