// Re-mounts on every navigation, so each page animates in.
export default function Template({ children }) {
  return <div className="page-enter">{children}</div>;
}
