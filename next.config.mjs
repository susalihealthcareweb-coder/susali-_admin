/** @type {import('next').NextConfig} */
const nextConfig = {
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
