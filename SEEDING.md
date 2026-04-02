# 🌱 Seed Data API Guide (Updated)

## Overview

The seed API endpoint loads **ALL CSV files** from a designated folder into Elasticsearch with a single Postman request. It's a **one-time setup process** (though you can run it multiple times - it won't create duplicates).

## Key Features

✅ **Folder-based**: Load all CSV files from a folder at once  
✅ **All fields indexed**: Every column from your CSV is indexed (not just predefined ones)  
✅ **Dynamic field detection**: Auto-detects field types (text, number, boolean)  
✅ **Unique documents**: Uses `product_id` as source of truth - prevents duplicates on re-runs  
✅ **Update-friendly**: Re-running seed updates existing products with same ID  
✅ **Configurable**: Set folder name and ID field in `.env`  

---

## Setup Instructions

### 1. Prepare Your CSV Files

Create a folder in the **root directory** (`d:\ideafest\`) and place your CSV files there:

```
d:\ideafest\data\
├── products.csv
├── electronics.csv
└── clothing.csv
```

**Required CSV Column:**
- **product_id** (or your configured ID field) - Must be unique per product

**Optional CSV Columns:**
- ANY column will be indexed (name, price, description, category, image, rating, reviews, stock, etc.)
- Extra columns are automatically detected and indexed
- Data types are intelligently converted (strings, numbers, booleans)

**Example CSV Structure:**
```csv
product_id,name,description,price,image,category,rating,reviews,stock,brand,color
PROD001,Wireless Headphones,High-quality wireless headphones,79.99,https://...,Electronics,4.5,230,150,BrandX,Black
PROD002,USB-C Cable,Durable USB-C charging cable,12.99,https://...,Accessories,4.8,1420,500,BrandY,White
```

### 2. Update Environment Variables

Edit `backend/.env`:

```env
PORT=5000
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_INDEX=products
SEED_DATA_FOLDER=data
SEED_DATA_ID_FIELD=product_id
```

- `SEED_DATA_FOLDER`: Folder name under root directory (where CSV files are)
- `SEED_DATA_ID_FIELD`: Column name used as unique identifier (default: product_id)

### 3. Install Dependencies

```bash
cd backend
npm install
```

This installs `csv-parser` for CSV parsing.

### 4. Start Backend Server

```bash
npm start
```

Server will start on `http://localhost:5000`

### 5. Call the Seed Endpoint from Postman

**Method:** `POST`  
**URL:** `http://localhost:5000/seed`  
**Body:** None (leave empty)  
**Headers:** No special headers needed

**Example cURL:**
```bash
curl -X POST http://localhost:5000/seed
```

### 6. Response

**Success (200):**
```json
{
  "success": true,
  "message": "Data seeded successfully",
  "index": "products",
  "idField": "product_id",
  "filesProcessed": 3,
  "totalRows": 5000,
  "documentsIndexed": 4995,
  "skipped": 5,
  "successful": 4995,
  "failed": 0,
  "note": "Documents with duplicate product_id will be updated instead of duplicated"
}
```

---

## How It Works

1. **Validates folder exists** and contains CSV files
2. **Reads all CSV files** from the folder
3. **Auto-detects all fields** and their types
4. **Creates or uses existing index** (doesn't delete old data)
5. **Uses product_id as document ID** - ensures uniqueness
6. **Bulk inserts/updates** all documents
7. **Returns detailed summary** with counts and statistics

### Field Type Detection

| Value | Type | Example |
|-------|------|---------|
| Empty | Skipped | `-` |
| `123` or `45.67` | Number | `123`, `45.67` |
| `true` / `false` | Boolean | `true`, `false` |
| Text | Keyword | `"Black"`, `"Electronics"` |

### Document Uniqueness

- **First run**: Creates all documents with product_id as `_id`
- **Second run**: If product_id exists, **updates** the document
- **Result**: No duplicates, even if you run seed multiple times

Example:

```
Run 1: Seed 1000 products
       ✓ 1000 new documents created

Run 2: Update 100 products + Add 50 new
       ✓ 100 existing documents updated
       ✓ 50 new documents created
       ✓ Total: 1050 documents
```

---

## Testing the Seeded Data

Once seeding is complete, test it:

### 1. Via Frontend
- Open `http://localhost:5173`
- Search for any term (e.g., "wireless", "laptop")
- Verify all fields are indexed and searchable
- Try filters, sorting, pagination

### 2. Via API - Search
```bash
# Basic search
GET http://localhost:5000/search?q=headphones

# With all filters
GET http://localhost:5000/search?q=headphones&minPrice=50&maxPrice=200&sort=price_asc&page=2
```

### 3. Count Documents
```bash
GET http://localhost:9200/products/_count
```

Response:
```json
{
  "count": 5000,
  "status": 200
}
```

### 4. Check Index Mappings
```bash
GET http://localhost:9200/products/_mappings
```

You'll see all your CSV columns listed as fields.

---

## Troubleshooting

### ❌ "Seed folder not found"

**Solution:**
- Create the folder: `mkdir d:\ideafest\data`
- Verify folder name in `.env` matches exactly
- Check folder path is correct

### ❌ "No CSV files found"

**Solution:**
- Ensure CSV files are in the configured folder
- Check files have `.csv` extension (lowercase)
- Verify files are not corrupted

### ❌ "No valid documents found"

**Solution:**
- Ensure CSV has the `product_id` column (or your configured ID field)
- Verify product_id values are not empty
- Check CSV is properly formatted

### ❌ Some documents skipped

**Solution:**
- Check console logs for which rows skipped and why
- Most common: missing product_id
- Fix CSV or increase validation tolerance

### ❌ Elasticsearch connection error

**Solution:**
- Verify Elasticsearch is running: `http://localhost:9200`
- Check `ELASTICSEARCH_URL` in `.env`

---

## Advanced Usage

### Running Seed Multiple Times

```bash
# First run
POST /seed  → Indexes 1000 documents

# Update some, add new
POST /seed  → Updates existing documents
            → Adds new documents
```

**No duplicates created! Only updates matching product_ids.**

### Multiple CSV Files

Place all files in the folder:

```
data/
├── products.csv
├── electronics.csv
├── clothing.csv
└── accessories.csv
```

Single `/seed` call processes all of them in one operation.

### Custom ID Field

If your CSV uses different ID column, update `.env`:

```env
SEED_DATA_ID_FIELD=sku
```

Or:

```env
SEED_DATA_ID_FIELD=item_id
```

### Large Datasets

- Split into multiple CSV files
- Place in same folder
- `/seed` handles all efficiently
- Elasticsearch bulk API optimized for large operations

### Incremental Updates

```bash
# Add new products to CSV
# Update prices in existing products
# Save CSV to data folder
# POST /seed
# ✓ New products indexed
# ✓ Existing products updated with latest data
```

---

## All Fields Are Indexed

**Every column from your CSV becomes searchable!**

Example: If your CSV has these columns:
```csv
product_id,name,price,description,color,brand,warranty,material,size_available
```

ALL 9 columns are:
- Indexed in Elasticsearch
- Available for filtering (if applicable)
- Searchable (if text)
- Sortable (if numeric)

You don't need to update code or mappings - it's all automatic!

---

## FAQ

**Q: Can I change the ID field?**  
A: Yes, set `SEED_DATA_ID_FIELD` in `.env` to your unique column name

**Q: What if product_id has duplicates in CSV?**  
A: Last occurrence wins (latest data overwrites earlier rows)

**Q: Can I add more CSV files later?**  
A: Yes, add files to folder and run `/seed` again

**Q: Does seeding delete old data?**  
A: No, it only updates matching product_ids and preserves others

**Q: How many files/rows can I seed?**  
A: Depends on server, but typically handles:
  - Unlimited CSV files (processes each)
  - 100k+ rows per file (bulk API optimized)
  - Monitor console for progress

**Q: Can I use different ID field per CSV?**  
A: No, same ID field used for all CSV files in the folder

**Q: How long does seeding take?**  
A: Typically 1-2 seconds per 1000 documents

---

## Next Steps

After seeding:
1. ✅ Search works with all indexed fields
2. ✅ All CSV columns are queryable
3. ✅ Try advanced filters and sorting
4. ✅ Verify pagination works
5. ✅ Check API response includes all fields
6. ✅ Ready for Phase 2!

---

**Last Updated:** April 1, 2026
