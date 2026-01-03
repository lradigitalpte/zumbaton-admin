# Supabase Storage Setup for User Avatars

This guide will help you set up Supabase Storage for user avatar uploads.

## Step 1: Create the Storage Bucket

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Storage** in the left sidebar
4. Click **New bucket**
5. Configure the bucket:
   - **Name**: `avatars`
   - **Public bucket**: ✅ **Enable this** (so avatars can be accessed via public URLs)
   - **File size limit**: 5242880 (5MB in bytes)
   - **Allowed MIME types**: 
     - `image/jpeg`
     - `image/png`
     - `image/webp`
     - `image/gif`
6. Click **Create bucket**

## Step 2: Set Up Storage Policies

After creating the bucket, you need to set up Row Level Security (RLS) policies. Go to **Storage** → **Policies** → **avatars**

### Policy 1: Users can upload their own avatars (INSERT)

1. Click **New Policy** → **For full customization**
2. Configure:
   - **Policy name**: `Users can upload their own avatars`
   - **Allowed operation**: INSERT
   - **Policy definition**:
   ```sql
   (bucket_id = 'avatars'::text) AND (auth.uid()::text = split_part(split_part(name, '/', -1), '-', 1))
   ```
   This extracts the filename (after the last `/`), then extracts the userId (before the first `-`)
   File format: `avatars/{userId}-{timestamp}.ext`
3. Click **Save**

### Policy 2: Users can update their own avatars (UPDATE)

1. Click **New Policy** → **For full customization**
2. Configure:
   - **Policy name**: `Users can update their own avatars`
   - **Allowed operation**: UPDATE
   - **Policy definition**:
   ```sql
   (bucket_id = 'avatars'::text) AND (auth.uid()::text = split_part(split_part(name, '/', -1), '-', 1))
   ```
3. Click **Save**

### Policy 3: Anyone can view avatars (SELECT)

Since the bucket is public, create a simple policy:

1. Click **New Policy** → **For full customization**
2. Configure:
   - **Policy name**: `Anyone can view avatars`
   - **Allowed operation**: SELECT
   - **Policy definition**:
   ```sql
   bucket_id = 'avatars'::text
   ```
3. Click **Save**

### Policy 4: Users can delete their own avatars (DELETE)

1. Click **New Policy** → **For full customization**
2. Configure:
   - **Policy name**: `Users can delete their own avatars`
   - **Allowed operation**: DELETE
   - **Policy definition**:
   ```sql
   (bucket_id = 'avatars'::text) AND (auth.uid()::text = split_part(split_part(name, '/', -1), '-', 1))
   ```
3. Click **Save**

## Step 3: Run Database Migrations

1. Run migration `012_add_profile_fields.sql` to add profile fields to the database
2. This adds: `date_of_birth`, `emergency_contact_name`, `emergency_contact_phone`, `bio`

## Step 4: Verify the Setup

After setting up the bucket and policies:

1. Test the avatar upload functionality in the profile page
2. Check that uploaded avatars appear in the Storage → avatars bucket
3. Verify that avatars are accessible via public URLs

## Notes

- File paths in the bucket follow the pattern: `avatars/{userId}-{timestamp}.{ext}`
- Maximum file size is 5MB
- Only image files (JPEG, PNG, WebP, GIF) are allowed
- Avatars are stored with public URLs for easy access
- Users can only upload, update, or delete files that start with their user ID
