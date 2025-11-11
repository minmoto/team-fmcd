"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { UserButton } from "@stackframe/stack";
import { LucideIcon, Menu } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";
import { buttonVariants } from "./ui/button";
import { Separator } from "./ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";

function useSegment(basePath: string) {
  const path = usePathname();
  const result = path.slice(basePath.length, path.length);
  return result ? result : "/";
}

type Item = {
  name: React.ReactNode;
  href: string;
  icon: LucideIcon;
  type: "item";
  subItems?: SubItem[];
};

type SubItem = {
  name: React.ReactNode;
  href: string;
  icon?: LucideIcon;
};

type Sep = {
  type: "separator";
};

type Label = {
  name: React.ReactNode;
  type: "label";
};

export type SidebarItem = Item | Sep | Label;

function SubNavItem(props: { item: SubItem; onClick?: () => void; basePath: string }) {
  const segment = useSegment(props.basePath);
  const selected = segment === props.item.href;

  return (
    <Link
      href={props.basePath + props.item.href}
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        selected && "bg-muted",
        "flex-grow justify-start text-sm text-zinc-600 dark:text-zinc-400 px-6"
      )}
      onClick={props.onClick}
      prefetch={true}
    >
      {props.item.icon && <props.item.icon className="mr-2 h-4 w-4" />}
      {props.item.name}
    </Link>
  );
}

function NavItem(props: { item: Item; onClick?: () => void; basePath: string }) {
  const segment = useSegment(props.basePath);
  const selected = segment === props.item.href;
  const hasSubItemSelected = props.item.subItems?.some(subItem => segment === subItem.href);

  return (
    <div className="w-full">
      <Link
        href={props.basePath + props.item.href}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          (selected || hasSubItemSelected) && "bg-muted",
          "flex-grow justify-start text-md text-zinc-800 dark:text-zinc-300 px-2 w-full"
        )}
        onClick={props.onClick}
        prefetch={true}
      >
        <props.item.icon className="mr-2 h-5 w-5" />
        {props.item.name}
      </Link>
      {props.item.subItems && props.item.subItems.length > 0 && (
        <div className="mt-1 space-y-1">
          {props.item.subItems.map((subItem, index) => (
            <div key={index} className="flex">
              <SubNavItem item={subItem} onClick={props.onClick} basePath={props.basePath} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarShimmer() {
  return (
    <div className="flex flex-grow flex-col gap-2 pt-4 overflow-y-auto">
      {/* Overview item shimmer */}
      <div className="px-2">
        <div className="flex items-center space-x-2 p-2 rounded">
          <div className="h-5 w-5 bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded"></div>
          <div className="h-4 w-16 bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded"></div>
        </div>
      </div>

      {/* Management label shimmer */}
      <div className="flex my-2">
        <div className="h-4 w-20 bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded px-2"></div>
      </div>

      {/* Federations item shimmer */}
      <div className="px-2">
        <div className="flex items-center space-x-2 p-2 rounded">
          <div className="h-5 w-5 bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded"></div>
          <div className="h-4 w-20 bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded"></div>
        </div>
        {/* Sub-items shimmer */}
        <div className="mt-1 space-y-1 ml-4">
          {[...Array(2)].map((_, index) => (
            <div key={index} className="flex items-center space-x-2 p-1 px-2">
              <div className="h-4 w-4 bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded"></div>
              <div className="h-3 w-24 bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Settings label shimmer */}
      <div className="flex my-2">
        <div className="h-4 w-16 bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded px-2"></div>
      </div>

      {/* Configuration item shimmer */}
      <div className="px-2">
        <div className="flex items-center space-x-2 p-2 rounded">
          <div className="h-5 w-5 bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded"></div>
          <div className="h-4 w-24 bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%] animate-[shimmer_2s_infinite] rounded"></div>
        </div>
      </div>

      <div className="flex-grow" />
    </div>
  );
}

function SidebarContent(props: {
  onNavigate?: () => void;
  items: SidebarItem[];
  sidebarTop?: React.ReactNode;
  basePath: string;
  isLoading?: boolean;
}) {
  const path = usePathname();
  const segment = useSegment(props.basePath);

  return (
    <div className="flex flex-col h-full items-stretch">
      <div className="h-14 flex items-center px-2 shrink-0 mr-10 md:mr-0 border-b">
        {props.sidebarTop}
      </div>
      {props.isLoading ? (
        <SidebarShimmer />
      ) : (
        <div className="flex flex-grow flex-col gap-2 pt-4 overflow-y-auto">
          {props.items.map((item, index) => {
            if (item.type === "separator") {
              return <Separator key={index} className="my-2" />;
            } else if (item.type === "item") {
              return (
                <div key={index} className="px-2">
                  <NavItem item={item} onClick={props.onNavigate} basePath={props.basePath} />
                </div>
              );
            } else {
              return (
                <div key={index} className="flex my-2">
                  <div className="flex-grow justify-start text-sm font-medium text-zinc-500 px-2">
                    {item.name}
                  </div>
                </div>
              );
            }
          })}

          <div className="flex-grow" />
        </div>
      )}
    </div>
  );
}

export type HeaderBreadcrumbItem = { title: string; href: string };

function HeaderBreadcrumb(props: {
  items: SidebarItem[];
  baseBreadcrumb?: HeaderBreadcrumbItem[];
  basePath: string;
}) {
  const segment = useSegment(props.basePath);
  const item = props.items.find(item => item.type === "item" && item.href === segment);
  const title: string | undefined = (item as any)?.name;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {props.baseBreadcrumb?.map((item, index) => (
          <React.Fragment key={index}>
            <BreadcrumbItem>
              <BreadcrumbLink href={item.href}>{item.title}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </React.Fragment>
        ))}

        <BreadcrumbItem>
          <BreadcrumbPage>{title}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export default function SidebarLayout(props: {
  children?: React.ReactNode;
  baseBreadcrumb?: HeaderBreadcrumbItem[];
  items: SidebarItem[];
  sidebarTop?: React.ReactNode;
  basePath: string;
  isLoading?: boolean;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div className="w-full flex">
      <div className="flex-col border-r w-[240px] h-screen sticky top-0 hidden md:flex">
        <SidebarContent
          items={props.items}
          sidebarTop={props.sidebarTop}
          basePath={props.basePath}
          isLoading={props.isLoading}
        />
      </div>
      <div className="flex flex-col flex-grow w-0">
        <div className="h-14 border-b flex items-center justify-between sticky top-0 bg-white dark:bg-black z-10 px-4 md:px-6">
          <div className="hidden md:flex">
            <HeaderBreadcrumb
              baseBreadcrumb={props.baseBreadcrumb}
              basePath={props.basePath}
              items={props.items}
            />
          </div>

          <div className="flex md:hidden items-center">
            <Sheet onOpenChange={open => setSidebarOpen(open)} open={sidebarOpen}>
              <SheetTrigger>
                <Menu />
              </SheetTrigger>
              <SheetContent side="left" className="w-[240px] p-0">
                <SidebarContent
                  onNavigate={() => setSidebarOpen(false)}
                  items={props.items}
                  sidebarTop={props.sidebarTop}
                  basePath={props.basePath}
                  isLoading={props.isLoading}
                />
              </SheetContent>
            </Sheet>

            <div className="ml-4 flex md:hidden">
              <HeaderBreadcrumb
                baseBreadcrumb={props.baseBreadcrumb}
                basePath={props.basePath}
                items={props.items}
              />
            </div>
          </div>

          <UserButton
            colorModeToggle={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}
          />
        </div>
        <div className="flex-grow">{props.children}</div>
      </div>
    </div>
  );
}
