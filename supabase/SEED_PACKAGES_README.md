# Package Seed File

This seed file creates all the Zumbaton packages (Adults and Kids) with the correct pricing.

## How to Run

### Option 1: Using Supabase SQL Editor
1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Copy and paste the contents of `seed_packages.sql`
4. Click **Run**

### Option 2: Using psql
```bash
psql -h your-db-host -U postgres -d your-database -f seed_packages.sql
```

### Option 3: Using Supabase CLI
```bash
supabase db execute -f supabase/seed_packages.sql
```

## What Gets Created

### Adults Packages (5 packages)
- **1 Session Pack** - $30 (7 days validity)
- **4 Session Pack** - $100 (30 days validity)
- **8 Session Pack** - $185 (60 days validity)
- **10 Session Pack** - $225 (60 days validity)
- **12 Session Pack** - $265 (90 days validity)

### Kids Packages (3 packages)
- **Kids 1 Session Pack** - $20 (7 days validity, age 5-12)
- **Kids 4 Session Pack** - $80 (30 days validity, age 5-12)
- **Kids 8 Session Pack** - $165 (60 days validity, age 5-12)

## Important Notes

1. **Before Running**: Make sure you've run the migration `009_add_package_type_fields.sql` first
2. **Existing Packages**: The seed file will INSERT new packages. If you want to clear existing packages first, uncomment the `DELETE FROM packages;` line at the top
3. **Promotions**: The referral fee (8% off) and early bird promo (15% off) are NOT packages - these should be handled in your application logic or a separate promotions table

## Verification

After running the seed, you can verify the packages were created:

```sql
SELECT 
  name,
  package_type,
  token_count,
  price_cents / 100.0 as price_sgd,
  validity_days,
  age_requirement,
  is_active
FROM packages
ORDER BY package_type, token_count;
```

You should see 8 packages total (5 adults + 3 kids).

