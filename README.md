# Ecommerce Search Application - MVP Phase 1

A full-stack ecommerce search application built with Node.js, Express, Elasticsearch, and React with Vite.

## Project Structure

```
├── backend/           # Node.js + Express API Server
│   ├── src/
│   │   └── server.js  # Main server file
│   ├── .env.example   # Environment variables template
│   └── package.json   # Backend dependencies
│
└── frontend/          # React + Vite Frontend
    ├── src/
    │   ├── components/
    │   │   ├── SearchBar.jsx          # Search input with suggestions
    │   │   ├── FilterBar.jsx          # Sort & price filter
    │   │   ├── ProductGrid.jsx        # Product grid layout
    │   │   ├── ProductCard.jsx        # Individual product card
    │   │   ├── Pagination.jsx         # Page navigation
    │   │   └── SearchSuggestions.jsx  # Trending searches
    │   ├── App.jsx
    │   └── main.jsx
    ├── index.html
    └── package.json   # Frontend dependencies
```

## Features

### Backend (Phase 1 Enhanced)
- ✅ Express API with CORS enabled
- ✅ Elasticsearch multi-match search with AUTO fuzziness
- ✅ **Pagination**: Page-based with 20 results per page
- ✅ **Sorting**: Relevance (default), price ascending, price descending
- ✅ **Filtering**: Price range (minPrice/maxPrice) and category
- ✅ **Search Analytics**: Tracks searches and returns trending searches
- ✅ **Input Sanitization**: Removes HTML/script tags
- ✅ Returns: id, name, price, image, category, description
- ✅ Proper error handling and async/await
- ✅ GET `/search?q=query&page=1&sort=relevance&minPrice=10&maxPrice=100`
- ✅ POST `/search/analytics` - Track search events
- ✅ GET `/search/trending` - Get trending searches
- ✅ Health check endpoint: GET `/health`

### Frontend (Phase 1 Enhanced)
- ✅ React 18 + Vite with modern hooks
- ✅ **SearchBar**: Debounced input (300ms) with suggestions dropdown
- ✅ **Search Suggestions**: Shows up to 5 trending searches
- ✅ **FilterBar**: Sort options and price range filters
- ✅ **Pagination**: Smart page navigation (first/prev/next/last)
- ✅ **ProductGrid**: Responsive (desktop: 3-4 cols, mobile: 2 cols)
- ✅ **ProductCard**: Image error handling with fallback
- ✅ **Client-Side Caching**: Caches search results by query+filters+page
- ✅ **Search Analytics**: Auto-tracks searches
- ✅ Loading state, empty state, and error handling
- ✅ Fallback data when API unavailable
- ✅ Fully responsive design (mobile-first)
- ✅ Modern UI: gradient header, smooth animations, polished transitions

## Prerequisites

- Node.js 16+ (https://nodejs.org/)
- Elasticsearch 8.0+ running locally or accessible via URL
  - Docker setup: `docker run -d -p 9200:9200 -e "discovery.type=single-node" -e "xpack.security.enabled=false" docker.elastic.co/elasticsearch/elasticsearch:8.11.0`

## Installation & Setup

### Quick Start (One Command)

1. From the root directory, install all dependencies:
   ```bash
   npm run install:all
   ```

2. Create `.env` file in backend folder:
   ```bash
   cd backend
   copy .env.example .env
   ```

3. Update `.env` with your Elasticsearch URL:
   ```
   PORT=5000
   ELASTICSEARCH_URL=http://localhost:9200
   ```

4. Run both backend and frontend with a single command:
   ```bash
   npm run dev
   ```

   This starts:
   - Backend server on `http://localhost:5000`
   - Frontend app on `http://localhost:5173`

### Individual Setup (Optional)

#### Backend Setup

1. Navigate to the backend folder:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file from the template:
   ```bash
   copy .env.example .env
   ```

4. Update `.env` with your Elasticsearch URL:
   ```
   PORT=5000
   ELASTICSEARCH_URL=http://localhost:9200
   ```

5. Start the server:
   ```bash
   npm start
   ```

   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

   Server will run on `http://localhost:5000`

#### Frontend Setup

1. Navigate to the frontend folder:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

   App will run on `http://localhost:5173`

## Usage

1. Make sure Elasticsearch is running
2. Start the backend server
3. Start the frontend development server
4. Open your browser at `http://localhost:5173`
5. Type in the search box to find products

## API Endpoints

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "OK"
}
```

### GET /search
Search for products with pagination, sorting, and filtering.

**Query Parameters:**
- `q` (required): Search query string
- `page` (optional): Page number (default: 1)
- `sort` (optional): Sort order - `relevance`, `price_asc`, `price_desc` (default: relevance)
- `minPrice` (optional): Minimum price filter
- `maxPrice` (optional): Maximum price filter
- `category` (optional): Category filter

**Examples:**
```
GET /search?q=headphones
GET /search?q=headphones&page=2&sort=price_asc
GET /search?q=laptop&minPrice=500&maxPrice=2000
```

**Response:**
```json
{
  "success": true,
  "count": 20,
  "total": 150,
  "page": 1,
  "totalPages": 8,
  "pageSize": 20,
  "results": [
    {
      "id": "1",
      "name": "Product Name",
      "price": 29.99,
      "image": "https://example.com/image.jpg",
      "category": "Electronics",
      "description": "Product description"
    }
  ]
}
```

### POST /search/analytics
Track search events for analytics.

**Request Body:**
```json
{
  "query": "headphones",
  "timestamp": "2024-03-31T10:30:00Z"
}
```

**Response:**
```json
{
  "success": true
}
```

### GET /search/trending
Get trending searches based on frequency.

**Response:**
```json
{
  "success": true,
  "trending": [
    {
      "query": "headphones",
      "count": 42
    },
    {
      "query": "laptop",
      "count": 35
    }
  ]
}
```

## Elasticsearch Index Setup

To test this with actual data, you need to create an index and add sample documents:

```bash
# Create index
curl -X PUT "localhost:9200/products"

# Add sample product
curl -X POST "localhost:9200/products/_doc/1" -H 'Content-Type: application/json' -d'{
  "name": "Wireless Headphones",
  "description": "High-quality wireless headphones with noise cancellation",
  "price": 79.99,
  "image": "https://via.placeholder.com/200x200?text=Headphones"
}'
```

## Building for Production

### Frontend Build
```bash
cd frontend
npm run build
```

This creates a `dist` folder with optimized production build.

**To serve the build locally:**
```bash
npm run preview
```

### Backend Production Setup
No build step required, but ensure:
1. Install all dependencies: `npm install`
2. Create `.env` with production values
3. Run with: `npm start`

**Environment variables for production:**
```
PORT=5000
ELASTICSEARCH_URL=https://your-elasticsearch-domain:9200
ELASTICSEARCH_INDEX=products
```

### Docker Deployment (Optional)

**Backend Dockerfile:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm install
COPY backend/src ./src
CMD ["npm", "start"]
```

**Frontend Dockerfile:**
```dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Deployment to Production

1. **Backend**: Deploy to cloud provider (AWS, Heroku, DigitalOcean, etc.)
   - Ensure Elasticsearch is accessible
   - Set environment variables

2. **Frontend**: Deploy build to static hosting
   - Netlify, Vercel, AWS S3 + CloudFront, GitHub Pages
   - Update API URL in frontend to point to production backend

3. **Elasticsearch**: Use managed service
   - Elastic Cloud, AWS OpenSearch, or self-hosted

### Performance Optimization

- Frontend caching is implemented (search results cached client-side)
- Pagination prevents loading too many results
- Vite automatically optimizes assets on build
- Consider CDN for image delivery
- Use compression on backend (gzip)
- Monitor API response times

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

MIT
