// vite.config.js
// Tells Vite's bundler (Rollup) that each of these HTML files is a page of its own.
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        add_review: resolve(__dirname, "html/add_review.html"),
        addbook: resolve(__dirname, "html/addbook.html"),
        book_info: resolve(__dirname, "html/book_info.html"),
        favorite_list: resolve(__dirname, "html/favorite_list.html"),
        filter: resolve(__dirname, "html/filter.html"),
        filtered: resolve(__dirname, "html/filtered.html"),
        library: resolve(__dirname, "html/library.html"),
        lists: resolve(__dirname, "html/lists.html"),
        login: resolve(__dirname, "html/login.html"),
        profile: resolve(__dirname, "html/profile.html"),
        review_detail: resolve(__dirname, "html/review_detail.html"),
        reviews: resolve(__dirname, "html/reviews.html"),
        search: resolve(__dirname, "html/search.html"),
        sort: resolve(__dirname, "html/sort.html"),
        index: resolve(__dirname, "index.html"),
      },
    },
  },
});
