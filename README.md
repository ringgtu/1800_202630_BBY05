# Book Organization App

## Overview

**Book Organization App** is a responsive web application designed to help book lovers discover, track, and organize their personal reading collections in one place. Users can search for books via the Google Books API, view detailed book info, write and read reviews, curate custom reading lists, manage a favorites collection, and interact with a simulated 3D digital personal library.

Developed for the COMP 1800 course, this project applies User-Centred Design practices and agile project management, and demonstrates integration with Firebase backend services for storing user favorites.

---

## Features

- **Google Books Search & Filtering**: Search millions of titles, sort by popularity or release date, and filter by genres and tags.
- **Detailed Book Profiles**: View book covers, authors, descriptions, page counts, publishers, release years, and retail/preview links.
- **Interactive 3D Digital Library**: Flip through personal saved books on an animated 3D bookshelf complete with interactive page-turning and custom reading notes.
- **Custom Lists & Collections**: Create, manage, and delete personalized book lists (e.g., "Want to Read", "Completed", or custom collections).
- **Reviews & Community Ratings**: Write star ratings and detailed reviews for any book, browse reviews written by others, and manage your past submissions.
- **Favorites**: Quickly favorite books with heart toggles and manage your saved collection from your profile.
- **User Authentication & Profile**: Secure sign-up and login powered by Firebase Authentication with customizable user avatars and reading preferences.
- **Responsive Design**: Mobile-friendly navigation, touch gestures (swiping through library books), and desktop responsiveness built with Bootstrap 5.

---

## Technologies Used

- **Frontend**: HTML, CSS, JavaScript
- **Framework & UI**: [Bootstrap 5](https://getbootstrap.com/), [Bootstrap Icons](https://icons.getbootstrap.com/), Popper.js
- **External API**: [Google Books API](https://developers.google.com/books)
- **Backend & Database**: [Firebase Authentication](https://firebase.google.com/docs/auth) and [Cloud Firestore](https://firebase.google.com/docs/firestore)
- **Build Tool**: [Vite](https://vitejs.dev/)

---

## Usage

### Local Development Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/ringgtu/1800_202630_BBY05.git
   cd 1800_202630_BBY05
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the project root (refer to `.env.example` if available) with your Firebase credentials and Google Books API key:

   ```env
   VITE_FIREBASE_API_KEY="YOUR_FIREBASE_API_KEY"
   VITE_FIREBASE_AUTH_DOMAIN="YOUR_PROJECT_ID.firebaseapp.com"
   VITE_FIREBASE_PROJECT_ID="YOUR_PROJECT_ID"
   VITE_FIREBASE_APP_ID="YOUR_FIREBASE_APP_ID"
   VITE_GOOGLE_BOOKS_API_KEY="YOUR_GOOGLE_BOOKS_API_KEY"
   ```

4. **Start the development server:**

   ```bash
   npm run dev
   ```

5. **Open in browser:**
   Navigate to the local address displayed in the terminal (usually `http://localhost:5173/`).

---

## Project Structure

```
1800_202630_BBY05/
├── html/                      # Application HTML pages
│   ├── add_review.html        # Write & submit book reviews
│   ├── addbook.html           # Search and add books to personal library
│   ├── book_info.html         # Detailed book information & retailer links
│   ├── favorite_list.html     # User's saved favorites
│   ├── filter.html            # Category & genre filters
│   ├── filtered.html          # Filtered search results
│   ├── library.html           # 3D interactive personal bookshelf
│   ├── lists.html             # Custom user reading lists
│   ├── login.html             # User authentication (Login / Sign up)
│   ├── profile.html           # User profile & avatar management
│   ├── review_detail.html     # Full view of an individual review
│   ├── reviews.html           # Book reviews listing
│   ├── search.html            # Search results display
│   └── sort.html              # Sort options for search
├── images/                    # Static image assets & app badges
├── src/                       # Application JavaScript logic
│   ├── components/            # Reusable Web Components (e.g. site-navbar)
│   ├── authentication.js      # Auth state and login handlers
│   ├── bookCovers.js          # Book cover resolution & aspect ratio fallbacks
│   ├── bookapi.js             # Google Books API integration
│   ├── firebaseConfig.js      # Firebase & Firestore initialization
│   ├── library.js             # 3D library interactions & Firestore books sync
│   ├── lists.js               # User lists management
│   ├── master.js              # Shared utility & API helper functions
│   └── profile.js             # Profile page logic
├── styles/                    # Stylesheets & CSS variables
│   └── style.css
├── index.html                 # Landing / Home page
├── package.json               # Project scripts & dependencies
└── README.md
```

---

## Contributors

- **Luka** - BCIT CST Student that loves hiking. Fun fact: He loves his Macbook that he recently got.
- **Emmanuel** - BCIT CST Student with a passion for outdoor adventures and user-friendly applications. Fun fact: Love hanging out with friend and family. Love playing video game and working out in my free times.
- **Zhuming Mai** - BCIT CST Student, high enthusiast to cryptograthy and cybersecurity. Fun fact: Has a collection of over 100 Canadian commemorative coin.
- **Tyki Mckinnon**- - BCIT CST Student with a passion for hiking as well as making new frineds to talk to. Fun fact: Loves to collect viynl records.

---

## Acknowledgments

- Book data and metadata provided by the [Google Books API](https://developers.google.com/books).
- Icons provided by [Bootstrap Icons](https://icons.getbootstrap.com/).

---

## License

This project is licensed under the MIT License. See the LICENSE file for details.
