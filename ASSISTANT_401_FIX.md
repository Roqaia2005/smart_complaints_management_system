# Assistant API 401 Error - Fix Documentation

## Problem Identified
The frontend requests to the Python assistant backend were potentially missing the Authorization header, causing 401 Unauthorized errors.

## Root Cause Analysis

### Authentication Flow
1. **Frontend** (`assistantService.ts`):
   - Creates axios instance pointing to `http://127.0.0.1:5000`
   - Has interceptor to add `Authorization: Bearer <token>` from zustand store
   - Token is retrieved via `useAuthStore.getState().token`

2. **Backend** (`ai_services/recommendation/assistant/routes.py` + `auth.py`):
   - Expects `Authorization: Bearer <token>` header
   - Validates JWT using `authenticate_assistant_user()`
   - Requires user role in: `{"manager", "admin", "super_admin"}`

3. **Token Generation** (Node.js Backend):
   - Generates JWT with payload: `{ id: user.id, role: user.role, faculty_id: user.faculty_id ?? null }`
   - Signs with JWT_SECRET from `backend/.env`

4. **Token Validation** (Python Backend):
   - Expects payload fields: `id` and `role`
   - Uses JWT_SECRET from `ai_services/recommendation/.env`
   - Both secrets match ✓

### Issues Found
- No logging to verify token availability
- No logging to confirm header attachment
- No user-friendly error messages
- No pre-flight checks before requests

## Fixes Implemented

### 1. Added Debug Logging (Request Interceptor)
```typescript
assistantApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  
  console.log('[Assistant API] Request to:', config.url);
  console.log('[Assistant API] Token available:', !!token);
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('[Assistant API] Authorization header set');
  } else {
    console.warn('[Assistant API] No token available - request will likely fail with 401');
  }
  
  return config;
});
```

**Purpose**: Logs every request to verify:
- Token is available in the store
- Authorization header is being set
- Which endpoint is being called

### 2. Added Response Interceptor for 401 Errors
```typescript
assistantApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('[Assistant API] 401 Unauthorized:', {
        url: error.config?.url,
        message: error.response?.data?.detail || error.response?.data?.message,
        hasAuthHeader: !!error.config?.headers?.Authorization,
      });
    }
    return Promise.reject(error);
  }
);
```

**Purpose**: Logs detailed 401 error information including:
- Which endpoint failed
- Error message from backend
- Whether the Authorization header was actually sent

### 3. Added Pre-flight Token Checks
All service methods now check for token existence before making requests:

```typescript
async generateBriefing(forceRefresh = false): Promise<GenerateBriefingResponse> {
  const token = useAuthStore.getState().token;
  if (!token) {
    throw new Error('No authentication token available. Please log in again.');
  }
  // ... rest of method
}
```

**Purpose**: Provides immediate, clear error if token is missing instead of waiting for backend 401.

### 4. Improved Error Messages
Each method now provides user-friendly error messages:

- **401 errors**: "Session expired. Please log in again to access the assistant."
- **403 errors**: "Access denied. Assistant is only available for managers and admins."
- **404 errors**: "Session not found. Please start a new briefing."
- **500 errors**: "Server error. Please try again later or contact support."
- **503 errors**: "Speech-to-text is temporarily unavailable. Please type your question instead."

## How to Debug

### Step 1: Check Browser Console
Open DevTools Console (F12) and look for these logs when using the assistant:

```
[Assistant API] Request to: /api/assistant/generate-briefing
[Assistant API] Token available: true/false
[Assistant API] Authorization header set
```

**If you see "Token available: false"**:
- User is not logged in
- Token was cleared from store
- Store hasn't rehydrated yet (page just loaded)

**If you see "Token available: true" but still get 401**:
- Token might be expired
- User role might not be in allowed roles (manager, admin, super_admin)
- Token might be malformed

### Step 2: Check Network Tab
In DevTools Network tab:
1. Find the failing request to `/api/assistant/*`
2. Check **Request Headers** for `Authorization: Bearer <token>`
3. Check **Response** for error details

### Step 3: Check Backend Logs
Look at Python backend console output for:
```
USER: <User object or None>
```

If USER is None, the token validation failed.

## Common Issues & Solutions

### Issue 1: Token Not Available
**Symptoms**: Console shows "Token available: false"

**Solutions**:
- Ensure user is logged in
- Check if auth store is persisting correctly
- Verify localStorage has `auth-storage-v2` key
- Check if page was refreshed and store needs rehydration

### Issue 2: Token Expired
**Symptoms**: Backend returns "Token expired."

**Solutions**:
- Tokens expire after 7 days (JWT_EXPIRES_IN=7d)
- User needs to log in again
- Consider implementing token refresh logic

### Issue 3: Invalid Role
**Symptoms**: Backend returns 403 "Assistant access is restricted to management roles."

**Solutions**:
- Verify user role in database is: manager, admin, or super_admin
- Student and officer roles cannot access assistant
- Check JWT payload includes correct role field

### Issue 4: Wrong Token Payload
**Symptoms**: Backend returns "Invalid token payload."

**Solutions**:
- Node.js backend generates: `{ id, role, faculty_id }`
- Python backend expects: `{ id, role }`
- Both use same JWT_SECRET ✓
- Verify Node.js is actually signing with these fields

## Testing the Fix

1. **Open browser console** (F12)
2. **Log in** with a manager/admin/super_admin account
3. **Navigate to assistant page**
4. **Trigger a request** (e.g., "Generate Briefing")
5. **Check console logs**:
   - Should see `[Assistant API] Token available: true`
   - Should see `[Assistant API] Authorization header set`
6. **Check Network tab**:
   - Request should have `Authorization: Bearer <token>` header
   - Response should be 200 (success) or detailed error

## Environment Variables

### Backend (.env)
```env
JWT_SECRET=c54c1725cc05a699c5c7c3c92bd6411481576d628980cab42b2186b5f5e0e42aade3d4560e69e5fdcd1d92c5a6cc0b10465baee9a82430c265434f7defb9c549
JWT_EXPIRES_IN=7d
```

### Python Assistant (.env)
```env
JWT_SECRET=c54c1725cc05a699c5c7c3c92bd6411481576d628980cab42b2186b5f5e0e42aade3d4560e69e5fdcd1d92c5a6cc0b10465baee9a82430c265434f7defb9c549
JWT_EXPIRES_IN=7d
```

**Both must match** ✓ (they do in current setup)

## Next Steps

1. **Test with debug logging enabled** - Check console logs when making assistant requests
2. **Verify token presence** - Confirm token exists in store and localStorage
3. **Check user role** - Ensure logged-in user has manager/admin/super_admin role
4. **Monitor 401 errors** - Use response interceptor logs to see exact failure reason
5. **Consider removing debug logs** once issue is resolved (or keep for production debugging)

## Additional Recommendations

### For Production
- Remove or reduce console.log statements (or use a logger with levels)
- Implement automatic token refresh before expiry
- Add redirect to login on 401 errors (uncomment the logout code in response interceptor)
- Consider adding a loading state while checking auth

### For Better UX
- Show a message if user tries to access assistant without proper role
- Auto-redirect to login if token is missing
- Show "Session expired" dialog with option to re-login

## Files Modified

- `frontend/src/api/assistantService.ts` - Added logging, pre-flight checks, and better error handling

## Verification Checklist

- [ ] Console shows token availability for each request
- [ ] Authorization header is present in Network tab
- [ ] 401 errors show detailed diagnostic information
- [ ] User-friendly error messages are displayed
- [ ] Pre-flight checks catch missing tokens early
- [ ] All assistant endpoints (generate-briefing, ask, stt, end-session) have the fixes