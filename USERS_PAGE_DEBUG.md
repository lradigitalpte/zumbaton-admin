# Users Page Debugging

## Current Status
The users page was updated to:
1. ✅ Use API client (`api.get()`)
2. ✅ Fetch from `/api/users` endpoint
3. ✅ Include React Query caching
4. ✅ Show loading state
5. ✅ Show error state

## If Page Keeps Loading

Check the browser console for these logs:

### 1. Check API Client Logs
Look for:
```
[API Client] Token obtained for endpoint: /api/users?...
[API Client] Token length: XXX
```

If you see "Not authenticated" errors, the session token is missing.

### 2. Check useUsers Hook Logs
Look for:
```
[useUsers] Fetching users from: /api/users?...
[useUsers] API Response: { hasError: ..., hasData: ..., ... }
[useUsers] Users array length: X
```

If you see errors here, check what the API actually returned.

### 3. Check Users Page Logs
Look for:
```
[UsersPage] State: { loading: ..., hasError: ..., usersCount: ... }
```

This shows if the query is stuck in loading state.

### 4. Check Network Tab
Open DevTools → Network tab:
- Find the `/api/users` request
- Check the **Status** (should be 200)
- Check the **Response** - should look like:
  ```json
  {
    "data": [...users array...],
    "pagination": { "total": X, "page": 1, "pageSize": 100 }
  }
  ```

### 5. Common Issues

#### Issue: "Not authenticated" error
- **Cause**: Session token not being sent
- **Fix**: Check if you're logged in. Try logging out and back in.

#### Issue: API returns 401
- **Cause**: RBAC middleware rejecting the request
- **Fix**: Check server logs for RBAC errors. Ensure user has `users.view_all` permission.

#### Issue: API returns 500
- **Cause**: Server error in `listUsers` function
- **Fix**: Check server console logs for the actual error.

#### Issue: Response structure mismatch
- **Cause**: API returns different format than expected
- **Fix**: Check the actual response in Network tab and update the hook accordingly.

## Testing Steps

1. Open browser console (F12)
2. Navigate to `/users` page
3. Check console logs
4. Check Network tab for `/api/users` request
5. Share the logs if page still doesn't load

