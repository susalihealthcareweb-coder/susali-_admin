/** @type {import('next').NextConfig} */
const nextConfig = {
  // The automated tests run a second server with its own build folder
  // (NEXT_DIST_DIR=.next/test, inside .next so the file watcher ignores it), so it can run next to your dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactCompiler: true,
  // pdfkit reads its font files from disk at runtime, so it must not be bundled.
  serverExternalPackages: ["pdfkit", "exceljs"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
