import './FilterBar.css';

function FilterBar({ minPrice, maxPrice, sortBy, color, category = '', specifications = {}, facets = { colors: [], categories: [], specifications: [] }, onFilterChange, onCategoryChange, onSpecificationChange, onResetFilters }) {
  // Price range options
  const priceRanges = [
    { label: 'Under ₹500', min: 0, max: 500 },
    { label: '₹500 - ₹1000', min: 500, max: 1000 },
    { label: '₹1000 - ₹2000', min: 1000, max: 2000 },
    { label: '₹2000 - ₹5000', min: 2000, max: 5000 },
    { label: 'Over ₹5000', min: 5000, max: 999999 },
  ];

  // Use only dynamic colors from facets (no fallback)
  const colors = facets.colors && facets.colors.length > 0
    ? facets.colors.map(f => f.value)
    : [];

  // Use only dynamic categories from facets (no fallback)
  const categories = facets.categories && facets.categories.length > 0
    ? facets.categories.map(f => ({ value: f.value, label: f.value, count: f.count }))
    : [];

  // Create a map of color counts for quick lookup
  const colorCountMap = facets.colors && facets.colors.length > 0
    ? facets.colors.reduce((acc, f) => ({ ...acc, [f.value]: f.count }), {})
    : {};

  const handlePriceRangeChange = (min, max) => {
    // If this range is already selected, uncheck it
    if (minPrice === min.toString() && maxPrice === max.toString()) {
      onFilterChange('', '', sortBy, color);
    } else {
      // Otherwise, select this range
      onFilterChange(min.toString(), max.toString(), sortBy, color);
    }
  };

  const handleColorChange = (selectedColor) => {
    onFilterChange(minPrice, maxPrice, sortBy, selectedColor === color ? '' : selectedColor);
  };

  const handleCategoryChange = (selectedCategory) => {
    if (onCategoryChange) {
      onCategoryChange(selectedCategory === category ? '' : selectedCategory);
    }
  };

  return (
    <div className="filter-sidebar-content">
      <h3 className="filter-title">Filters</h3>

      {/* Price Filter */}
      <div className="filter-section">
        <h4 className="filter-section-title">Price</h4>
        <div className="checkbox-list">
          {priceRanges.map((range) => (
            <label key={`${range.min}-${range.max}`} className="checkbox-item">
              <input
                type="checkbox"
                checked={minPrice === range.min.toString() && maxPrice === range.max.toString()}
                onChange={() => handlePriceRangeChange(range.min, range.max)}
              />
              <span className="checkbox-label">{range.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Color Filter - only show if facets have data */}
      {colors.length > 0 && (
        <div className="filter-section">
          <h4 className="filter-section-title">Color</h4>
          <div className="checkbox-list">
            {colors.map((c) => (
              <label key={c} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={color === c}
                  onChange={() => handleColorChange(c)}
                />
                <span className="checkbox-label">
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                  {colorCountMap[c] >= 0 && (
                    <span className="filter-count">({colorCountMap[c]})</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Category Filter - only show if facets have data */}
      {categories.length > 0 && (
        <div className="filter-section">
          <h4 className="filter-section-title">Category</h4>
          <div className="checkbox-list">
            {categories.map((cat) => (
              <label key={cat.value} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={category === cat.value}
                  onChange={() => handleCategoryChange(cat.value)}
                />
                <span className="checkbox-label">
                  {cat.label.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                  {cat.count >= 0 && (
                    <span className="filter-count">({cat.count})</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Specification Filters - dynamic from API */}
      {facets.specifications && facets.specifications.length > 0 && (
        <>
          {facets.specifications.map((spec) => {
            // Convert to camelCase: "fabric care" -> "fabricCare"
            const camelCaseName = spec.name
              .split(' ')
              .map((word, index) => {
                if (index === 0) return word; // First word stays lowercase
                return word.charAt(0).toUpperCase() + word.slice(1);
              })
              .join('');
            
            // Display format: "fabricCare" -> "Fabric Care"
            const displayName = camelCaseName
              .replace(/([A-Z])/g, ' $1')
              .trim()
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');

            return (
              <div key={spec.name} className="filter-section">
                <h4 className="filter-section-title">{displayName}</h4>
                <div className="checkbox-list">
                  {spec.values && spec.values.length > 0 && (
                    spec.values.map((valueObj) => (
                      <label key={valueObj.value} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={specifications[spec.name]?.includes(valueObj.value) || false}
                          onChange={() => onSpecificationChange(spec.name, valueObj.value)}
                        />
                        <span className="checkbox-label">
                          {valueObj.value.charAt(0).toUpperCase() + valueObj.value.slice(1)}
                          <span className="filter-count">({valueObj.count})</span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}

      <button className="reset-btn" onClick={onResetFilters}>
        Clear All Filters
      </button>
    </div>
  );
}

export default FilterBar;
