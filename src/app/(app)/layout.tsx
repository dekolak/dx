import { BottomNav } from "@/components/BottomNav";

// Layout des pages protégées : conteneur mobile + barre de navigation basse.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="app">{children}</main>
      <BottomNav />
    </>
  );
}
