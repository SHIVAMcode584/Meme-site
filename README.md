# 🚀 MemeHub – AI Powered Meme Platform

MemeHub is a modern full-stack web application where users can **discover, upload, like, and search memes** based on real-life situations, moods, and reactions.

It combines **Supabase backend + React frontend** with features like authentication, meme uploads, likes system, and AI-based search.

---

## 🌐 Live Demo
👉 https://meme-site-lovat.vercel.app/

---

## ✨ Features

### 🔐 Authentication
- Email/Password login & signup
- Magic link login
- Password reset via email

---

### 🖼️ Meme Upload System
- Upload memes with:
  - Title
  - Image URL
  - Category
  - Mood
  - Keywords
- Stored in Supabase database

---

### ❤️ Like / Upvote System
- Like & unlike memes
- Prevent duplicate likes
- Real-time like count

---

### 👤 User Profiles
- Username-based identity
- Points system for engagement
- Profile linked with uploads

---

### 🔍 Smart Search (AI Ready)
- Search memes by:
  - Mood
  - Situation
  - Keywords
- Future-ready for AI semantic search

---

### 🔥 Trending System
- Most liked memes
- Engagement-based ranking

---

### 📱 PWA Support
- Installable as app on mobile & desktop
- Custom icon + standalone mode

---

## 🛠️ Tech Stack

### Frontend
- React (Vite)
- Tailwind CSS
- Lucide Icons

### Backend
- Supabase (Auth + Database + Storage)

### Database
- PostgreSQL (via Supabase)
- RLS (Row Level Security)

---

## 🧩 Database Structure

### Tables:

#### `meme-table`
- id
- title
- image_url
- category
- mood
- keywords
- user_id
- created_at

---

#### `profiles`
- id (auth.users)
- username
- points

---

#### `likes`
- id
- user_id
- meme_id
- created_at

Constraints:
- Unique (user_id, meme_id)

---

## 🔐 Security (RLS)

- Users can only modify their own data
- Likes are protected via RLS policies
- Profiles are safely managed

---

## ⚙️ Setup Instructions

### 1. Clone Repo
```bash
git clone https://github.com/SHIVAMcode584/memehub.git
cd memehub
