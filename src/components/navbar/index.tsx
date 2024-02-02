import React from "react";
import {Navbar, NavbarBrand, NavbarContent, NavbarItem, Link, Button, NavbarMenuItem, NavbarMenu, NavbarMenuToggle} from "@nextui-org/react";
import {AcmeLogo} from "./AcmeLogo.jsx";
import { useRouter } from "next/router.js";

export default function App() {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const router = useRouter(); // 获取路由信息

  const menuItems = [
    { label: "主页", route: "/owner" },
    { label: "Web3工具", route: "/tools" },
    { label: "看线", route: "/" },
  ];

  return (
    <Navbar onMenuOpenChange={setIsMenuOpen}>
      <NavbarContent>
        <NavbarMenuToggle
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          className="sm:hidden"
        />
        <NavbarBrand>
          <AcmeLogo />
          <p className="font-bold text-inherit">0xshahai</p>
        </NavbarBrand>
      </NavbarContent>

      <NavbarContent className="hidden sm:flex gap-16" justify="center">
        <NavbarItem>
          <Link color="foreground" href="/owner">
            主页
          </Link>
        </NavbarItem>
        <NavbarItem >
          <Link href="/tools" color="foreground">
            Web3工具
          </Link>
        </NavbarItem>
        <NavbarItem>
          <Link color="foreground" href="#">
            页面三
          </Link>
        </NavbarItem>
      </NavbarContent>
      <NavbarContent justify="end">
        <NavbarItem>
          <Button as={Link} color="primary" href="#" variant="flat">
            connect wallet
          </Button>
        </NavbarItem>
      </NavbarContent>

      <NavbarMenu>
        {menuItems.map((item, index) => (
          <NavbarMenuItem key={`${item.label}-${index}`}>
            <Link
              color="foreground"
              className="w-full"
              href={item.route}
              size="lg"
            >
              {item.label}
            </Link>
          </NavbarMenuItem>
        ))}
      </NavbarMenu>
    </Navbar>
  );
}
