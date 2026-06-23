import { type ReactNode } from "react";
import { SidebarShell } from "../../components/sidebar-shell";

// このグループ配下（/dashboard など）だけにサイドバーを出す。/login には付かない。
export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return <SidebarShell>{children}</SidebarShell>;
}
