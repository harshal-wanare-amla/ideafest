import ProductCard from './ProductCard';
import './ProductGrid.css';

function ProductGrid({ products, onProductClick }) {
  return (
    <div className="product-grid">
      {products.map((product, index) => (
        <ProductCard 
          key={product.id} 
          product={product} 
          onProductClick={onProductClick}
          index={index}
        />
      ))}
    </div>
  );
}

export default ProductGrid;
