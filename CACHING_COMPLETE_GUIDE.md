# Complete Caching Strategy Guide

## Two-Layer Caching System

We now have **BOTH** client-side and server-side caching working together:

### Layer 1: Client-Side (React Query) ✅ Already Done!
**Purpose:** Prevents browser from calling Next.js API unnecessarily  
**What it does:**
- Caches data in browser memory
- Shows cached data instantly
- Only refetches when needed

**Example:**
```tsx
// Browser caches this
const { data } = useStaff()
// Next visit: No API call! Uses cache.
```

---

### Layer 2: Server-Side (HTTP Cache Headers) ✅ Just Added!
**Purpose:** Reduces Next.js → Supabase database calls  
**What it does:**
- Adds HTTP cache headers to API responses
- Browser/CDN can cache the response
- Next.js API can serve cached data

**Example:**
```ts
// API route returns cached response
return cachedResponse(data, 'medium')
// Next.js can serve from cache, no Supabase call needed
```

---

## How They Work Together

```
Browser Request Flow:

1. First Request:
   Browser → Next.js API → Supabase
   (No cache, fetch from DB)

2. Second Request (within 5 min):
   Browser → Next.js API (cache hit!) ✅
   (No Supabase call)

3. After React Query cache expires:
   Browser → Next.js API (cache hit!) ✅
   (Still no Supabase call - server cache)

4. After both caches expire:
   Browser → Next.js API → Supabase
   (Fresh data from DB)
```

---

## Cache Duration Strategy

| Data Type | Client Cache | Server Cache | Reason |
|-----------|--------------|--------------|--------|
| **Users/Staff** | 5 min | 5 min | Changes infrequently |
| **Public Lists** | 5 min | 1 min | Changes more often |
| **User Details** | 5 min | 5 min | Personal data, infrequent changes |
| **Real-time** | No cache | No cache | Live updates needed |
| **Static** | 1 hour | 1 hour | Rarely changes |

---

## When to Use Each

### Client-Side Caching (React Query)
✅ **Use for:**
- List pages (users, staff, orders)
- Detail pages
- Form data that doesn't change often

❌ **Don't use for:**
- Real-time data (live notifications)
- User-specific sensitive data
- Data that changes on every request

### Server-Side Caching (Cache Headers)
✅ **Use for:**
- Read-heavy endpoints
- Public data
- Reference data

❌ **Don't use for:**
- Write operations (POST, PUT, DELETE)
- Personal/sensitive data
- Real-time data

---

## Quick Reference

### Add Client-Side Caching to Any Page
```tsx
import { useEntityList } from '@/hooks/useEntityQuery'

const { data, isLoading } = useEntityList({
  endpoint: '/api/items',
  queryKey: 'items',
})
```

### Add Server-Side Caching to Any API Route
```ts
import { cachedResponse, CACHE_PRESETS } from '@/lib/api-cache'

return cachedResponse(data, CACHE_PRESETS.users)
```

---

## Performance Impact

**Before (No Caching):**
- Every page load: Browser → Next.js → Supabase
- 10 page loads = 10 database queries
- Slow, expensive

**After (With Both Caches):**
- First load: Browser → Next.js → Supabase (1 DB query)
- Next 10 loads: Browser (cache hit!) (0 DB queries)
- Fast, cheap

**Result:** ~90% reduction in database calls! 🚀

---

## Best Practices

1. **Cache duration based on data volatility**
   - Static data → Long cache (1 hour)
   - User data → Medium cache (5 min)
   - Real-time → No cache

2. **Invalidate cache on mutations**
   - After creating/updating: Clear cache
   - React Query handles this automatically

3. **Use appropriate cache levels**
   - Public data → Public cache
   - Private data → Private cache

4. **Monitor cache hit rates**
   - Check browser DevTools → Network
   - See cache hits (304 responses)

---

## Summary

✅ **Client-side caching** - Solves your "too many API calls" problem  
✅ **Server-side caching** - Reduces database load even more  
✅ **Both together** - Maximum performance, minimum load  

**You now have a complete caching solution!** 🎉

