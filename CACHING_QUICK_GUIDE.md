# Quick Guide: Adding Caching to Any Page

## The Problem
You don't need to refactor every page manually! Here's a simple 3-step pattern to add caching to any page.

## Step-by-Step Guide

### Step 1: Replace `useState` + `useEffect` with React Query Hook

**Before:**
```tsx
const [data, setData] = useState([])
const [loading, setLoading] = useState(true)

useEffect(() => {
  loadData()
}, [])

const loadData = async () => {
  setLoading(true)
  const response = await api.get('/api/items')
  setData(response.data?.data || [])
  setLoading(false)
}
```

**After (using generic hook):**
```tsx
import { useEntityList, useInvalidateEntity } from '@/hooks/useEntityQuery'

const { data = [], isLoading: loading, refetch } = useEntityList({
  endpoint: '/api/items',
  queryKey: 'items',
  filters: { status: 'active' } // optional
})
```

That's it! Data is now cached automatically.

---

### Step 2: Add Refresh Button (Optional)

```tsx
import { RefreshCw } from 'lucide-react'

const { invalidateAll } = useInvalidateEntity('items')

<button onClick={() => {
  invalidateAll()
  refetch()
}}>
  <RefreshCw className="h-4 w-4" />
  Refresh
</button>
```

---

### Step 3: Handle Mutations (Create/Update/Delete)

**Before:**
```tsx
const handleCreate = async () => {
  await api.post('/api/items', data)
  await loadData() // Manual reload
}
```

**After:**
```tsx
import { useEntityMutation } from '@/hooks/useEntityQuery'

const { invalidateAll } = useInvalidateEntity('items')

const createMutation = useEntityMutation({
  queryKey: 'items',
  mutationFn: async (newData) => {
    return await api.post('/api/items', newData)
  },
  invalidateQueries: true, // Auto-refreshes cache
})

// Use it:
createMutation.mutate(data)
```

---

## Common Patterns

### Pattern 1: List Page
```tsx
// Staff Management, Users, Orders, etc.
const { data = [], isLoading, error, refetch } = useEntityList({
  endpoint: '/api/users',
  queryKey: 'users',
  filters: { role: 'admin' }
})
```

### Pattern 2: Detail Page
```tsx
// User Detail, Order Detail, etc.
const { data, isLoading, error, refetch } = useEntityDetail({
  endpoint: '/api/users',
  queryKey: 'users',
  id: params.id
})
```

### Pattern 3: Create Form
```tsx
const { invalidateAll } = useInvalidateEntity('users')

const createMutation = useEntityMutation({
  queryKey: 'users',
  mutationFn: async (data) => api.post('/api/users', data),
  invalidateQueries: true,
  onSuccess: () => {
    router.push('/users')
  }
})
```

### Pattern 4: Update Form
```tsx
const { invalidateDetail, invalidateAll } = useInvalidateEntity('users')

const updateMutation = useEntityMutation({
  queryKey: 'users',
  mutationFn: async (data) => api.put(`/api/users/${id}`, data),
  invalidateQueries: true,
  onSuccess: () => {
    invalidateDetail(id)
    setShowForm(false)
  }
})
```

---

## Full Example: Converting a Page

### Before (Old Way):
```tsx
export default function ItemsPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    loadItems()
  }, [])
  
  const loadItems = async () => {
    setLoading(true)
    const response = await api.get('/api/items')
    setItems(response.data?.data || [])
    setLoading(false)
  }
  
  return <div>...</div>
}
```

### After (With Caching):
```tsx
import { useEntityList, useInvalidateEntity } from '@/hooks/useEntityQuery'
import { RefreshCw } from 'lucide-react'

export default function ItemsPage() {
  const { data: items = [], isLoading: loading, refetch } = useEntityList({
    endpoint: '/api/items',
    queryKey: 'items',
  })
  
  const { invalidateAll } = useInvalidateEntity('items')
  
  const handleRefresh = () => {
    invalidateAll()
    refetch()
  }
  
  return (
    <div>
      <button onClick={handleRefresh}>
        <RefreshCw /> Refresh
      </button>
      {/* Rest of your component */}
    </div>
  )
}
```

**That's it!** Just 3 lines changed, and you have full caching!

---

## Benefits

✅ **No more redundant API calls** - Data loads once, cached automatically  
✅ **Instant navigation** - Cached data shows immediately  
✅ **Easy to implement** - Just replace useState/useEffect with hooks  
✅ **Automatic cache invalidation** - Mutations refresh cache automatically  
✅ **Manual refresh** - Refresh button when you need fresh data  

---

## When to Use Each Hook

| Hook | Use Case | Example |
|------|----------|---------|
| `useEntityList` | List/table pages | Staff list, Users list, Orders list |
| `useEntityDetail` | Detail/view pages | User detail, Order detail, Item detail |
| `useInvalidateEntity` | After mutations | After creating/updating/deleting |
| `useEntityMutation` | Create/Update/Delete | Forms, buttons, actions |

---

## Pro Tips

1. **Use specific query keys** - Name them by entity: `'users'`, `'orders'`, `'packages'`
2. **Add filters** - Cache different filter combinations separately
3. **Invalidate strategically** - Invalidate list + detail after updates
4. **Refresh button** - Always add one for user control

---

## Need Help?

If you're converting a specific page and get stuck, just ask! The pattern is the same for all pages:
1. Replace useState + useEffect with React Query hook
2. Add refresh button (optional)
3. Use mutations for create/update/delete

That's it! No need to manually refactor everything - just follow this pattern. 🚀

