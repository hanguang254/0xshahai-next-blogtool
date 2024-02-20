import React, { useEffect } from "react";
import {Navbar, NavbarBrand, NavbarContent, NavbarItem, Link, Button, NavbarMenuItem, NavbarMenu, NavbarMenuToggle} from "@nextui-org/react";
import {AcmeLogo} from "./AcmeLogo.jsx";
import { useRouter } from "next/router.js";

export default function App() {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const router = useRouter(); // 获取路由信息

  const menuItems = [
    { label: "主页", route: "/owner" },
    { label: "Web3工具", route: "/tools" },
    { label: "Web3导航", route: "/page3"},
  ];


  useEffect(() => {
    const handleHashChange = () => {
      // 获取当前哈希路由
      const hashRoute = window.location.hash.substring(1);
      // 使用 router.replace 触发路由变化
      router.replace(hashRoute, undefined, { shallow: true });
    };

    // 添加哈希路由变化事件监听
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      // 在组件卸载时移除事件监听
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [router]);

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
        {menuItems.map((item, index) => (
          <NavbarItem key={`${item.label}-${index}`}>
            <Link color="foreground" href={`#${item.route}`}>
              {item.label}
            </Link>
          </NavbarItem>
        ))}
      </NavbarContent>
      <NavbarContent justify="end">
        <NavbarItem>
          <Button isDisabled as={Link} color="primary" href="#" variant="flat">
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
