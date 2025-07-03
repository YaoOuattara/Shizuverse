# Static Module

This module holds static files used by the Shizu backend, especially assets like uploaded images.

## Structure

- `uploads/`: Directory for storing uploaded profile photos and documents. Auto-created if not existing during runtime.

## Usage Notes

- Profile photo uploads and any user-generated content will be stored here.
- Make sure this path is write-accessible by the backend server (Flask/WSGI/etc).
