"use client";
import { useState } from "react";
import { Popover } from "radix-ui";
import { Command } from "cmdk";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "./ui/button";
import { useTranslation } from "./preferences";
export const categories = [
  "Electronics",
  "Computers & Accessories",
  "Phones & Accessories",
  "Cameras & Photography",
  "Gaming",
  "Fashion & Clothing",
  "Shoes & Footwear",
  "Jewelry & Accessories",
  "Bags & Luggage",
  "Beauty & Personal Care",
  "Health & Wellness",
  "Home & Kitchen",
  "Furniture",
  "Home Decor",
  "Garden & Outdoor",
  "Food & Beverage",
  "Sports & Fitness",
  "Automotive",
  "Tools & Hardware",
  "Office Supplies",
  "Books & Stationery",
  "Arts & Crafts",
  "Music & Instruments",
  "Toys & Games",
  "Baby & Kids",
  "Pet Supplies",
  "Travel",
  "Gifts",
  "Software & Digital Products",
  "Services",
  "Other",
];
export function CategoryCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (s: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { t } = useTranslation();
  function select(s: string) {
    onChange(s);
    setOpen(false);
  }
  return (
    <div className="field">
      <span id="category-label">{t("Category")}</span>
      <input type="hidden" name="category" value={value} />
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-labelledby="category-label"
            className="justify-between whitespace-normal"
          >
            {(categories.includes(value) ? t(value) : value) ||
              t("Search or enter a category")}
            <ChevronsUpDown />
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            aria-label={t("Category")}
            align="start"
            className="z-50 w-[min(360px,calc(100vw-2rem))] rounded-lg border bg-card p-2 shadow-lg"
          >
            <Command shouldFilter={false}>
              <Command.Input
                aria-label={t("Search or enter a category")}
                placeholder={t("Search or enter a category")}
                value={search}
                onValueChange={setSearch}
                maxLength={100}
                className="w-full border-b bg-transparent p-3 outline-none"
              />
              <Command.List
                className="max-h-64 overflow-y-auto"
                aria-label={t("Category")}
              >
                {categories
                  .filter((s) =>
                    [s, t(s)].some((label) =>
                      label.toLowerCase().includes(search.trim().toLowerCase()),
                    ),
                  )
                  .map((s) => (
                    <Command.Item
                      className="cursor-pointer rounded p-3 data-[selected=true]:bg-accent"
                      key={s}
                      onSelect={() => select(s)}
                    >
                      {t(s)}
                    </Command.Item>
                  ))}
                {search.trim() &&
                  !categories.some(
                    (s) => s.toLowerCase() === search.trim().toLowerCase(),
                  ) && (
                    <Command.Item
                      className="cursor-pointer rounded p-3 data-[selected=true]:bg-accent"
                      value={search}
                      onSelect={() => select(search.trim())}
                    >
                      {t("Use")} &quot;{search.trim()}&quot;
                    </Command.Item>
                  )}
              </Command.List>
            </Command>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
